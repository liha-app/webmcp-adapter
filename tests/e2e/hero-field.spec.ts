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
    await page.waitForTimeout(700);
  });

  test('sits behind the words and never takes a click', async ({ page }) => {
    const canvas = page.getByTestId('hero-field');
    await expect(canvas).toBeAttached();
    await expect(canvas).toHaveAttribute('aria-hidden', 'true');
    expect(await canvas.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');

    // The call to action is on top of it, and reachable.
    const target = page.locator('.hero__cta a').first();
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

  test('draws in all five colours', async ({ page }) => {
    const buckets = await page.evaluate(() => {
      const canvas = document.querySelector('[data-testid="hero-field"]') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d')!;
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // Bucket by hue rather than by exact value: a dot is drawn at whatever
      // alpha its twinkle is on, and the band and the pointer shift it.
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
      const found = { purple: 0, blue: 0, orange: 0, green: 0, teal: 0 };
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3]! < 90) continue;
        const h = hue(data[i]!, data[i + 1]!, data[i + 2]!);
        if (h < 0) continue;
        if (h >= 255 && h < 300) found.purple += 1;
        else if (h >= 200 && h < 255) found.blue += 1;
        else if (h >= 15 && h < 50) found.orange += 1;
        else if (h >= 100 && h < 165) found.green += 1;
        else if (h >= 165 && h < 200) found.teal += 1;
      }
      return found;
    });
    for (const [name, count] of Object.entries(buckets)) {
      expect(count, `${name} is missing from the field`).toBeGreaterThan(40);
    }
  });

  test('the pointer parts the field around it', async ({ page }) => {
    const canvas = page.getByTestId('hero-field');
    const box = (await canvas.boundingBox())!;
    const x = Math.round(box.width * 0.22);
    const y = Math.round(box.height * 0.6);

    /*
     * The signature is not "fewer dots" — the pointer brightens and enlarges
     * what it touches, which puts lit pixels back. It is that the dots move
     * outward: the core thins while the ring around it fills. Measuring the
     * two against each other also cancels the twinkle, which changes the whole
     * field's brightness from frame to frame.
     */
    const density = async () => {
      let core = 0;
      let outer = 0;
      for (let i = 0; i < 6; i += 1) {
        core += await litPixels(page, x, y, 34);
        outer += await litPixels(page, x, y, 120);
        await page.waitForTimeout(110);
      }
      return core / Math.max(1, outer - core);
    };

    await page.mouse.move(4, 4);
    await page.waitForTimeout(800);
    const away = await density();

    await page.mouse.move(box.x + x, box.y + y);
    await page.mouse.move(box.x + x + 2, box.y + y + 2, { steps: 5 });
    await page.waitForTimeout(800);
    const under = await density();

    expect(under).toBeLessThan(away * 0.72);
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
    // Something has to be on it — "still" must not mean "blank".
    expect(await litPixels(page, 200, 200, 120)).toBeGreaterThan(50);
    await page.mouse.move(400, 500);
    await page.waitForTimeout(1400);
    expect(await fieldHash(page)).toBe(first);
  });
});
