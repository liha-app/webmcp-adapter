/*
 * The landing page's pictures, taken from the product rather than drawn.
 *
 *   pnpm demo            # the four sites, from their production builds
 *   pnpm capture         # this
 *
 * Every image here is a real browser looking at a real build with the real
 * extension loaded: the demo sites, the Studio with a draft in it, the
 * extension's own consent window, and a screencast of a tool call actually
 * moving a page. A landing page that claims an adapter drives a real site
 * should not illustrate that with a drawing of one.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { Browser, findChromeBinary, sleep } from '../acceptance/chrome.mjs';

const root = process.cwd();
const EXT = join(root, 'apps/extension/dist');
const OUT = join(root, 'apps/registry/public/shots');
const WORK = join(root, 'node_modules/.cache/capture');

const SITES = {
  crm: 'http://localhost:5273',
  shop: 'http://localhost:5274',
  project: 'http://localhost:5275',
  portal: 'http://localhost:5280',
};

async function shot(page, file, { width = 1440, height = 900 } = {}) {
  await page.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 2,
    mobile: false,
  });
  await sleep(600);
  const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(WORK, `${file}.png`), Buffer.from(data, 'base64'));
  return join(WORK, `${file}.png`);
}

/*
 * Screenshots to something a landing page can afford, with `sips` and nothing
 * else.
 *
 * Not WebP: this machine's ffmpeg is built without a WebP encoder, macOS
 * `sips` cannot write one, and handing a 1600px PNG to a page as base64 to use
 * the browser's encoder never returns — the eval is a couple of megabytes of
 * string. JPEG at 88 is a few hundred KB per image, every browser reads it, and
 * for a screenshot of a page it is indistinguishable at this size.
 */
function toJpeg(pairs) {
  for (const [src, name, width] of pairs) {
    const out = join(OUT, `${name}.jpg`);
    execFileSync('sips', ['-Z', String(width), '-s', 'format', 'jpeg', '-s', 'formatOptions', '88', src, '--out', out], {
      stdio: 'ignore',
    });
    const size = Number(execFileSync('stat', ['-f', '%z', out]).toString().trim());
    console.log(`  ${name}.jpg ${(size / 1024) | 0}KB`);
  }
}

/** The same tool stream the acceptance runners watch. */
function trackTools(session) {
  const tools = new Map();
  session.on((message) => {
    if (message.method === 'WebMCP.toolsAdded') {
      for (const tool of message.params.tools ?? []) tools.set(tool.name, tool);
    } else if (message.method === 'WebMCP.toolsRemoved') {
      for (const name of message.params.names ?? []) tools.delete(name);
    }
  });
  return tools;
}

async function until(probe, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await probe();
    if (value) return value;
    await sleep(200);
  }
  return null;
}

async function main() {
  if (!existsSync(join(EXT, 'manifest.json'))) throw new Error('Extension is not built. Run `pnpm build`.');
  mkdirSync(OUT, { recursive: true });
  mkdirSync(WORK, { recursive: true });

  // The screencast records the window rather than an emulated viewport, so the
  // window is the frame: 1280x720 with no browser chrome in headless.
  const browser = new Browser({
    binary: findChromeBinary(),
    extensionPath: EXT,
    flags: ['--window-size=1280,720'],
  }).launch();
  const png = [];
  try {
    await browser.ready();
    const page = await browser.firstPage();
    await page.send('WebMCP.enable').catch(() => undefined);

    console.log('stills');
    await page.goto(`${SITES.shop}/`);
    await sleep(1800);
    png.push([await shot(page, 'shop'), 'shop', 1600]);

    await page.goto(`${SITES.crm}/`);
    await sleep(1200);
    png.push([await shot(page, 'crm'), 'crm', 1600]);

    await page.goto(`${SITES.project}/`);
    await sleep(1200);
    png.push([await shot(page, 'project'), 'project', 1600]);

    await page.goto(`${SITES.portal}/create`);
    await sleep(2000);
    await page.eval(`(() => {
      const box = document.querySelector('[data-testid="draft-json"]');
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      setter.call(box, ${JSON.stringify(JSON.stringify(
        {
          id: 'kite-tasks',
          name: 'Kite Project Manager',
          version: '1.0.0',
          origins: ['https://demo-project.liha.review'],
          tools: [
            {
              name: 'list_tasks',
              description: 'Return the task list.',
              capability: 'READ',
              inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Search text' } } },
              steps: [
                { type: 'fill', selector: "[data-testid='task-search']", value: '{{query}}' },
                { type: 'readList', selector: "[data-testid='task-list'] li", as: 'tasks' },
              ],
            },
            {
              name: 'set_status',
              description: 'Change a task status.',
              capability: 'WRITE',
              inputSchema: { type: 'object', properties: { status: { type: 'string', description: 'New status' } }, required: ['status'] },
              steps: [
                { type: 'select', selector: "[data-testid='status']", value: '{{status}}' },
                { type: 'waitFor', selector: "[data-testid='task-list']" },
                { type: 'readText', selector: "[data-testid='status']", as: 'status' },
              ],
            },
          ],
        },
        null,
        2,
      ))});
      box.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await sleep(1200);
    await page.eval(`document.querySelector('[data-testid="agent-build"]').scrollIntoView({ block: 'start' })`);
    png.push([await shot(page, 'studio'), 'studio', 1600]);

    /*
     * The same page, three times, with a real tool call between each.
     *
     * The landing page cross-fades these, which says the thing a video would
     * say — an agent asked, the store's own controls moved — without a video
     * pipeline. CDP's screencast produces no frames in headless (it reports the
     * page as not visible and declines), and three frames is not worth a
     * second browser stack to work around that.
     */
    const tools = trackTools(page);
    await page.goto(`${SITES.shop}/`);
    const ready = await until(async () => (tools.has('choose_top') ? tools.get('choose_top') : null));
    if (!ready) throw new Error('the shop adapter never registered — is the WebMCP flag on?');
    const call = async (toolName, input) => {
      const tool = tools.get(toolName);
      if (!tool) throw new Error(`${toolName} is not registered`);
      await page.send('WebMCP.invokeTool', { frameId: tool.frameId, toolName, input });
      await sleep(1200);
    };

    console.log('drive');
    png.push([await shot(page, 'drive-1'), 'drive-1', 1280]);
    await call('choose_top', { top: 'Solid walnut' });
    png.push([await shot(page, 'drive-2'), 'drive-2', 1280]);
    await call('choose_base', { base: 'Adjustable + memory' });
    await call('add_to_bag', {});
    png.push([await shot(page, 'drive-3'), 'drive-3', 1280]);

    console.log('encode');
    toJpeg(png);
  } finally {
    browser.close();
  }
}

main().catch((error) => {
  console.error(`\nStopped: ${error.message}`);
  process.exitCode = 1;
});
