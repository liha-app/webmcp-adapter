import { expect, test, type Page } from '@playwright/test';

/**
 * The hero's particle field.
 *
 * It is decoration, so most of what matters is what it must not do: sit in
 * front of a link, keep animating when the visitor has asked for less motion,
 * or quietly lose four of its five colours. The canvas is 2D, so these read its
 * pixels rather than compare screenshots — the field moves on its own, and a
 * test that diffs two frames of a moving thing proves nothing about the frame.
 */
const PORTAL = 'http://localhost:5280/';

/**
 * A fingerprint of what the canvas itself holds.
 *
 * Not an element screenshot: the hero's words are painted over this canvas, so
 * screenshotting the element captures them too, and a link changing colour
 * under the cursor reads as the field having moved. Pixels only.
 */
async function fieldHash(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="hero-field"]') as HTMLCanvasElement;
    const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
    let hash = 2166136261;
    for (let i = 0; i < data.length; i += 4) {
      hash ^= data[i]! + data[i + 1]! * 3 + data[i + 2]! * 7 + data[i + 3]! * 11;
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  });
}

/** Alpha-weighted pixel counts inside a disc, in canvas-local coordinates. */
async function litPixels(page: Page, x: number, y: number, radius: number) {
  return page.evaluate(
    ([cx, cy, r]) => {
      const canvas = document.querySelector('[data-testid="hero-field"]') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d')!;
      const box = canvas.getBoundingClientRect();
      const ratio = canvas.width / box.width;
      const data = ctx.getImageData((cx - r) * ratio, (cy - r) * ratio, 2 * r * ratio, 2 * r * ratio).data;
      let lit = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i]! > 16) lit += 1;
      return lit;
    },
    [x, y, radius] as const,
  );
}

test.describe('the hero field', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PORTAL);
    // Wait for the canvas to be sized and painted rather than for a stopwatch:
    // five of these running at once starve each other's frames, and a sleep
    // that is long enough on an idle machine is not long enough on a busy one.
    await page.waitForFunction(() => {
      const canvas = document.querySelector('[data-testid="hero-field"]') as HTMLCanvasElement | null;
      if (!canvas || canvas.width === 0) return false;
      const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 3; i < data.length; i += 4) if (data[i]! > 16) return true;
      return false;
    });
  });

  test('sits behind the words and never takes a click', async ({ page }) => {
    const canvas = page.getByTestId('hero-field');
    await expect(canvas).toBeAttached();
    await expect(canvas).toHaveAttribute('aria-hidden', 'true');
    expect(await canvas.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');

    // The call to action is on top of it, and reachable.
    const target = page.locator('.hero__cta a').first();
    await expect(target).toBeVisible();
    const box = (await target.boundingBox())!;
    const onTop = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x, y)?.closest('a') !== null,
      [box.x + box.width / 2, box.y + box.height / 2] as const,
    );
    expect(onTop).toBe(true);
  });

  test('keeps moving on its own, with no pointer anywhere near it', async ({ page }) => {
    const first = await fieldHash(page);
    await page.waitForTimeout(900);
    expect(await fieldHash(page)).not.toBe(first);
  });

  test('rests in the brand colour, and opens into the others under the pointer', async ({ page }) => {
    // Five colours scattered at random read as mess. The field is one colour
    // until it is touched, and the other four live in the pocket.
    const hues = () =>
      page.evaluate(() => {
        const canvas = document.querySelector('[data-testid="hero-field"]') as HTMLCanvasElement;
        const ctx = canvas.getContext('2d')!;
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const hue = (r: number, g: number, b: number) => {
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          if (max === min) return -1;
          const d = max - min;
          let h: number;
          if (max === r) h = ((g - b) / d + 6) % 6;
          else if (max === g) h = (b - r) / d + 2;
          else h = (r - g) / d + 4;
          return h * 60;
        };
        const found = { brand: 0, purple: 0, blue: 0, orange: 0, green: 0, other: 0 };
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3]! < 90) continue;
          const h = hue(data[i]!, data[i + 1]!, data[i + 2]!);
          if (h < 0) continue;
          if (h >= 165 && h < 200) found.brand += 1;
          else if (h >= 255 && h < 300) found.purple += 1;
          else if (h >= 200 && h < 255) found.blue += 1;
          else if (h >= 15 && h < 50) found.orange += 1;
          else if (h >= 100 && h < 165) found.green += 1;
          else found.other += 1;
        }
        return found;
      });

    await page.mouse.move(2, 2);
    await expect
      .poll(async () => Object.values(await hues()).reduce((a, b) => a + b, 0), { timeout: 10_000 })
      .toBeGreaterThan(400);
    const rest = await hues();
    const restTotal = Object.values(rest).reduce((a, b) => a + b, 0);
    expect(rest.brand / restTotal).toBeGreaterThan(0.9);

    const box = (await page.getByTestId('hero-field').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.45);
    await page.mouse.move(box.x + box.width / 2 + 3, box.y + box.height * 0.45 + 3, { steps: 6 });
    const restOther = rest.purple + rest.blue + rest.orange + rest.green;
    await expect
      .poll(
        async () => {
          const touched = await hues();
          return touched.purple + touched.blue + touched.orange + touched.green;
        },
        { timeout: 10_000 },
      )
      .toBeGreaterThan(restOther + 200);
  });

  test('gathers the dots into the mark', async ({ page }) => {
    /*
     * The field is the product's shape, not a texture. At the top of the loop
     * the dots are packed into the mark's silhouette and the corners of the
     * section are empty; polled across a full cycle, that moment has to happen.
     */
    const canvas = page.getByTestId('hero-field');
    const box = (await canvas.boundingBox())!;
    const middle = [Math.round(box.width / 2), Math.round(box.height * 0.42)] as const;
    const corner = [Math.round(box.width * 0.08), Math.round(box.height * 0.85)] as const;

    await expect
      .poll(
        async () => {
          const inside = await litPixels(page, middle[0], middle[1], 70);
          const outside = await litPixels(page, corner[0], corner[1], 70);
          return inside / Math.max(1, outside);
        },
        { timeout: 30_000, intervals: [250] },
      )
      .toBeGreaterThan(8);
  });

  test('the pointer parts the field around it', async ({ page }) => {
    const canvas = page.getByTestId('hero-field');
    const box = (await canvas.boundingBox())!;
    const x = Math.round(box.width / 2);
    const y = Math.round(box.height * 0.42);

    /*
     * Measured while the mark is held together, and both readings taken inside
     * that window. The field's density is a moving target across the gather and
     * scatter, so comparing a reading from one phase against a reading from
     * another says nothing about the pointer.
     */
    await expect
      .poll(
        async () => {
          const inside = await litPixels(page, x, y, 70);
          const outside = await litPixels(page, Math.round(box.width * 0.08), Math.round(box.height * 0.85), 70);
          return inside / Math.max(1, outside);
        },
        { timeout: 30_000, intervals: [250] },
      )
      .toBeGreaterThan(8);

    /*
     * The signature is not "fewer dots" — the pointer brightens and enlarges
     * what it touches, which puts lit pixels back. It is that the dots move
     * outward: the core thins while the ring around it fills. Measuring the two
     * against each other also cancels the twinkle, which changes the whole
     * field's brightness from frame to frame.
     */
    const density = async () => {
      let core = 0;
      let outer = 0;
      for (let i = 0; i < 4; i += 1) {
        core += await litPixels(page, x, y, 34);
        outer += await litPixels(page, x, y, 120);
        await page.waitForTimeout(60);
      }
      return core / Math.max(1, outer - core);
    };

    const away = await density();
    await page.mouse.move(box.x + x, box.y + y);
    await page.mouse.move(box.x + x + 2, box.y + y + 2, { steps: 5 });
    await expect.poll(density, { timeout: 20_000, intervals: [200] }).toBeLessThan(away * 0.72);
  });
});

test.describe('the hero field, with reduced motion', () => {
  test('draws one frame and then holds still', async ({ page }) => {
    /*
     * Emulated here rather than through `test.use({ reducedMotion })`, which
     * this project's config silently does not apply — the page came up with
     * `prefers-reduced-motion` unset and the field animating. The assertion
     * below is what caught it, and it stays so the next version cannot quietly
     * turn this test into one that proves nothing.
     */
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(PORTAL);
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    await page.waitForTimeout(800);
    const first = await fieldHash(page);
    /*
     * Something has to be on it — "still" must not mean "blank". Sampled at the
     * middle because the still frame is the gathered mark, not the scattered
     * field: with reduced motion the loop is the motion, so the mark is held
     * together rather than caught mid-scatter.
     */
    const box = (await page.getByTestId('hero-field').boundingBox())!;
    expect(await litPixels(page, box.width / 2, box.height * 0.42, 90)).toBeGreaterThan(50);
    await page.mouse.move(400, 500);
    await page.waitForTimeout(1400);
    expect(await fieldHash(page)).toBe(first);
  });
});
