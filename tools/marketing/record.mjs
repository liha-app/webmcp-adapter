/*
 * The landing page's video: a tool call actually moving a page.
 *
 *   pnpm demo && pnpm build && pnpm record
 *
 * The browser is the one the acceptance runners use — real extension, real
 * WebMCP flag — and the calls go through the DevTools WebMCP domain. So the
 * recording is the real pipeline: an agent asks, the runtime replays the
 * adapter's steps, and the store's own controls move. Nothing is scripted DOM
 * poking and nothing is staged.
 *
 * Frames are sampled with Page.captureScreenshot on a fixed cadence rather than
 * taken from Page.startScreencast. The screencast is the obvious tool and it
 * does not work here: headless Chrome emits a frame only when its compositor
 * produces one, which for a page that is mostly still means one frame and then
 * silence — and it reports that by saying nothing at all. Sampling is slower to
 * capture and gives an even timeline.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Browser, findChromeBinary, sleep } from '../acceptance/chrome.mjs';

const root = process.cwd();
const EXT = join(root, 'apps/extension/dist');
const OUT = join(root, 'apps/registry/public/shots');
const WORK = join(root, 'node_modules/.cache/record');
const FRAMES = join(WORK, 'frames');

const WIDTH = 1280;
const HEIGHT = 800;
const EVERY_MS = 110;

function trackTools(session) {
  const tools = new Map();
  session.on((message) => {
    if (message.method === 'WebMCP.toolsAdded') {
      for (const tool of message.params.tools ?? []) tools.set(tool.name, tool);
    }
  });
  return tools;
}

async function main() {
  if (!existsSync(join(EXT, 'manifest.json'))) throw new Error('Extension is not built. Run `pnpm build`.');
  rmSync(WORK, { recursive: true, force: true });
  mkdirSync(FRAMES, { recursive: true });
  mkdirSync(OUT, { recursive: true });

  const browser = new Browser({ binary: findChromeBinary(), extensionPath: EXT }).launch();
  try {
    await browser.ready();
    const page = await browser.firstPage();
    await page.send('WebMCP.enable');
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: 1,
      mobile: false,
    });

    const tools = trackTools(page);
    await page.goto('http://localhost:5274/');
    for (let i = 0; i < 80 && !tools.has('choose_top'); i += 1) await sleep(250);
    if (!tools.has('choose_top')) throw new Error('the shop adapter never registered — is the extension built?');
    await sleep(1200);

    let index = 0;
    let sampling = true;
    const sampler = (async () => {
      while (sampling) {
        const started = Date.now();
        try {
          const { data } = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
          writeFileSync(join(FRAMES, `${String(index++).padStart(5, '0')}.jpg`), Buffer.from(data, 'base64'));
        } catch {
          /* a navigation can eat one frame; the next one lands */
        }
        const spent = Date.now() - started;
        if (spent < EVERY_MS) await sleep(EVERY_MS - spent);
      }
    })();

    const call = async (toolName, input) => {
      const tool = tools.get(toolName);
      if (!tool) throw new Error(`${toolName} is not registered`);
      await page.send('WebMCP.invokeTool', { frameId: tool.frameId, toolName, input });
    };

    const startedAt = Date.now();
    await sleep(900);
    await call('choose_top', { top: 'Solid walnut' });
    await sleep(1500);
    await call('choose_base', { base: 'Adjustable + memory' });
    await sleep(1500);
    await call('add_to_bag', {});
    await sleep(2200);
    const elapsed = (Date.now() - startedAt) / 1000;

    sampling = false;
    await sampler;
    if (index < 12) throw new Error(`only ${index} frames were captured`);

    /* The real rate, so the video runs at the speed the page actually moved. */
    const fps = Math.max(4, Math.min(20, Math.round(index / elapsed)));
    const input = ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(FRAMES, '%05d.jpg')];
    /*
     * H.264 and nothing else. A VP9 WebM was published alongside this and it
     * looked fine in every check that watched it play: it decodes, it reaches
     * the last frame. It fails on the way back — `loop` seeks to zero and the
     * pipeline errors out (`PIPELINE_ERROR_DECODE`), on the same Chrome that
     * plays it straight through. Re-encoding with a keyframe every second did
     * not change it; VP8 and H.264 are both unaffected. H.264 is also a third
     * of the size of either WebM on this footage, so the second encoding was
     * costing bytes to ship a defect.
     */
    execFileSync('ffmpeg', [...input, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-movflags', '+faststart', '-an', join(OUT, 'drive.mp4')]);
    execFileSync('sips', ['-Z', '1280', '-s', 'format', 'jpeg', '-s', 'formatOptions', '86', join(FRAMES, '00000.jpg'), '--out', join(OUT, 'drive-poster.jpg')], { stdio: 'ignore' });

    const size = (name) => `${(Number(execFileSync('stat', ['-f', '%z', join(OUT, name)]).toString().trim()) / 1024) | 0}KB`;
    console.log(`  ${index} frames over ${elapsed.toFixed(1)}s → ${fps}fps`);
    for (const name of ['drive.mp4', 'drive-poster.jpg']) console.log(`  ${name} ${size(name)}`);
  } finally {
    browser.close();
  }
}

main().catch((error) => {
  console.error(`\nStopped: ${error.message}`);
  process.exitCode = 1;
});
