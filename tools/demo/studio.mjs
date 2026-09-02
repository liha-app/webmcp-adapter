#!/usr/bin/env node
/**
 * Records the Studio demo, by performing it.
 *
 *   pnpm build && pnpm demo:studio
 *
 * Every frame in the finished video is a screenshot of a real browser doing the
 * real thing: the recorder listening to genuine DOM events, the Studio rendering
 * what it captured, Chrome's own confirmation window, and — at the end — an
 * agent outside the page invoking the tool over the DevTools WebMCP domain and
 * getting an answer out of the site.
 *
 * Nothing here is staged. If the product breaks, the demo cannot be produced,
 * which is the property a demo of a working thing should have.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, Session, findChromeBinary, findExtensionId, sleep } from '../acceptance/chrome.mjs';
import { serveStatic } from '../acceptance/serve.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const EXT_DIST = join(root, 'apps/extension/dist');
const SHOP = join(root, 'apps/demo-shop/dist');
const PORT = 5274;
const ORIGIN = `http://localhost:${PORT}`;
const OUT = join(root, 'docs/demo');
const FRAMES = join(OUT, '.frames');

/** Typed into a controlled React input the way a person does. */
const typeInto = (selector, value) => `(() => {
  const input = document.querySelector(${JSON.stringify(selector)});
  if (!input) return false;
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set;
  setter.call(input, ${JSON.stringify(value)});
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`;

/**
 * React owns these fields, so the value goes through the element's own setter
 * and the events React listens for are dispatched by hand — assigning `.value`
 * updates the DOM and leaves the component's state behind.
 */
function setNative(selector, value) {
  return [
    '(() => {',
    '  const el = document.querySelector(' + JSON.stringify(selector) + ');',
    '  if (!el) return false;',
    "  const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : Object.getPrototypeOf(el);",
    "  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, " + JSON.stringify(value) + ');',
    "  el.dispatchEvent(new Event('input', { bubbles: true }));",
    "  el.dispatchEvent(new Event('change', { bubbles: true }));",
    '  return true;',
    '})()',
  ].join('\n');
}

const clickOn = (selector) => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return false;
  el.click();
  return true;
})()`;

async function waitFor(probe, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await probe().catch(() => null);
    if (value) return value;
    await sleep(150);
  }
  return null;
}

const shots = [];

/**
 * One beat of the story: a screenshot, and the sentence it is evidence for.
 * The caption is drawn in a browser rather than by ffmpeg so the type matches
 * the product's own.
 */
async function beat(session, title, note) {
  const shot = await session.send('Page.captureScreenshot', { format: 'png' });
  shots.push({ title, note, png: shot.data });
  console.log(`  ${String(shots.length).padStart(2)}. ${title}`);
}

async function main() {
  if (!existsSync(join(EXT_DIST, 'manifest.json'))) throw new Error('Extension is not built. Run `pnpm build`.');
  if (!existsSync(SHOP)) throw new Error('Demo shop is not built. Run `pnpm build`.');

  const { close: stopServer } = await serveStatic(SHOP, PORT);
  const browser = new Browser({ binary: findChromeBinary(), extensionPath: EXT_DIST, headless: true }).launch();

  try {
    await browser.ready();
    const shop = await browser.firstPage();
    await shop.send('Emulation.setDeviceMetricsOverride', { width: 1120, height: 430, deviceScaleFactor: 1, mobile: false });
    await shop.goto(`${ORIGIN}/`);
    await sleep(1200);

    const id = await findExtensionId(browser);
    if (!id) throw new Error('the extension did not start');

    // English, so the frames read the same wherever this is generated.
    const settings = await browser.newPage();
    await settings.goto(`chrome-extension://${id}/manage/manage.html`);
    await settings.eval(`chrome.storage.local.set({ 'liha/locale': 'en' })`);
    // The shipped adapter is switched off, so the site starts with nothing an
    // agent can use. What appears later is only what the Studio produced.
    await settings.eval(`chrome.runtime.sendMessage({ type: 'liha/set-enabled', adapterId: 'demo-shop', enabled: false })`);
    settings.close();
    await sleep(400);
    await shop.reload?.();
    await shop.goto(`${ORIGIN}/`);
    await sleep(1200);

    const before = await shop.eval(`(async () => (await document.modelContext.getTools()).length)()`);
    if (before !== 0) throw new Error(`expected no tools before recording, found ${before}`);
    await beat(shop, 'An ordinary storefront', 'document.modelContext.getTools() → []. No adapter, nothing for an agent to use.');

    /* ------------------------------------------------------------ record -- */
    const popup = await browser.newPage();
    await popup.send('Emulation.setDeviceMetricsOverride', { width: 380, height: 560, deviceScaleFactor: 1, mobile: false });
    await shop.send('Page.bringToFront');
    await popup.goto(`chrome-extension://${id}/popup/popup.html`);
    await waitFor(async () => popup.eval(`Boolean(document.querySelector('[data-action="toggle-recording"]'))`));
    await sleep(500);
    await beat(popup, 'Press Record', 'The popup reports on the page in front of it. Nothing is scoped to this site yet.');

    await popup.eval(`document.querySelector('[data-action="toggle-recording"]').click()`);
    await waitFor(async () => {
      const state = await popup.eval("chrome.runtime.sendMessage({ type: 'liha/get-state' })");
      return state?.recording != null;
    });

    // The workflow, performed by hand.
    await shop.send('Page.bringToFront');
    await shop.eval(clickOn('[data-action="view-products"]'));
    await sleep(400);
    await shop.eval(typeInto('[data-testid="product-search"]', 'cable'));
    await sleep(700);
    await beat(shop, 'Do the thing you want the agent to do', 'The recorder is listening to real DOM events — clicks and inputs, not keystrokes.');

    await popup.eval(`document.querySelector('[data-action="toggle-recording"]').click()`);
    await sleep(900);

    /* ------------------------------------------------------------ studio -- */
    const target = await browser.waitForTarget((c) => c.type === 'page' && c.url.includes('studio/studio.html'), 20000);
    if (!target) throw new Error('stopping the recording did not open the Studio');
    const studio = await new Session(target.webSocketDebuggerUrl).open();
    await studio.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 820, deviceScaleFactor: 1, mobile: false });
    await waitFor(async () => studio.eval(`Boolean(document.querySelector('.node[data-kind]'))`));
    await sleep(700);
    await beat(studio, 'The Studio has the workflow', 'Selectors come from the site’s own stable attributes. Class names are never used.');

    await studio.eval(typeInto('input[placeholder="create_customer"]', 'find_products'));
    await sleep(200);
    await studio.eval(typeInto('textarea', 'Search the catalogue by keyword and return the matching product names.'));
    await sleep(900);
    await beat(studio, 'Name it, and say what it does', 'That description is what an agent reads to decide when to use the tool.');

    /*
      * The value typed during the recording is not baked in — it becomes the
      * tool's argument, and naming it is the point of this screen. The field
      * lives on the step, so the step has to be open.
      */
    await studio.eval(`[...document.querySelectorAll('.node[data-param="1"]')][0].click()`);
    await sleep(400);
    await studio.eval(typeInto('input[placeholder="parameter name"]', 'keyword'));
    await sleep(400);
    // Its description belongs to the tool, so back to the trigger node.
    await studio.eval(`document.querySelector('.node--trigger').click()`);
    await sleep(400);
    await studio.eval(typeInto('input[placeholder="What should the agent put here?"]', 'What to search the catalogue for'));
    await sleep(700);
    await beat(studio, 'The value you typed becomes an argument', '“cable” was an example, not a constant. It is now an input the agent fills in.');

    /*
     * Reading the result is not an interaction, so the recorder never saw it.
     * The author adds it — which is the other half of what the Studio is for.
     */
    // The add button selects what it just created, so the editor on the right
    // is already the new step.
    await studio.eval(`document.querySelector('.node__add').click()`);
    await sleep(500);
    const last = await studio.eval(`document.querySelectorAll('.node[data-kind]').length`);
    await studio.eval(setNative(`select[aria-label="Step ${last} type"]`, 'readList'));
    await sleep(300);
    await studio.eval(
      setNative(`.step input[placeholder="CSS selector"]`, "[data-testid='product-list'] [data-field='name']"),
    );
    await sleep(200);
    await studio.eval(setNative('.step input[placeholder="output name"]', 'products'));
    await sleep(800);
    await beat(studio, 'Add the step the recorder could not see', 'Reading the answer back is not an interaction, so nobody clicked it. You add it here.');

    await studio.eval(
      `[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Test selectors')).click()`,
    );
    await waitFor(async () => {
      const text = await studio.eval('document.body.innerText');
      return text.includes('resolve to exactly one element') ? text : null;
    });
    await sleep(600);
    await beat(studio, 'Check the selectors against the live page', 'Ambiguous selectors are refused at runtime, so they are caught here instead.');

    /* ----------------------------------------------------------- install -- */
    await studio.eval(
      `[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Install locally')).click()`,
    );
    const confirmTarget = await browser.waitForTarget(
      (c) => c.type === 'page' && c.url.includes('confirm/confirm.html'),
      20000,
    );
    if (!confirmTarget) throw new Error('no install confirmation appeared');
    const confirm = await new Session(confirmTarget.webSocketDebuggerUrl).open();
    await confirm.send('Emulation.setDeviceMetricsOverride', { width: 460, height: 620, deviceScaleFactor: 1, mobile: false });
    await waitFor(async () => confirm.eval('Boolean(document.querySelector("button"))'));
    await sleep(500);
    await beat(confirm, 'A person approves the origins and capabilities', 'The Studio asking is a request. Nothing installs without this.');
    await confirm.eval(`document.querySelector('button[data-decision="allow"]').click()`);
    await sleep(1200);

    /* -------------------------------------------------------------- live -- */
    const watch = { tools: new Map(), events: [] };
    const agent = await browser.newPage();
    await agent.send('Emulation.setDeviceMetricsOverride', { width: 1120, height: 430, deviceScaleFactor: 1, mobile: false });
    agent.on((message) => {
      if (message.method === 'WebMCP.toolsAdded') for (const tool of message.params.tools ?? []) watch.tools.set(tool.name, tool);
      if (message.method === 'WebMCP.toolResponded') watch.events.push(message.params);
    });
    await agent.send('WebMCP.enable');
    await agent.goto(`${ORIGIN}/`);
    const registered = await waitFor(async () => watch.tools.get('find_products'), 20000);
    if (!registered) throw new Error('the tool the Studio produced never registered');
    await beat(agent, 'Reload: the tool an agent can see', 'find_products is registered with WebMCP. The site was not touched.');

    await agent.send('WebMCP.invokeTool', {
      frameId: registered.frameId,
      toolName: 'find_products',
      input: { keyword: 'cable' },
    });
    const answered = await waitFor(async () => watch.events[0] ?? null, 25000);
    if (!answered) throw new Error('the tool never answered');
    const text = (answered.output?.content ?? []).map((part) => part.text ?? '').join(' ');
    if (answered.output?.isError) throw new Error(`the tool answered with an error: ${text}`);
    await sleep(600);
    await beat(agent, 'An agent outside the page runs it', text.replace(/\s+/g, ' ').slice(0, 150));

    console.log(`\n  the tool answered: ${text.replace(/\s+/g, ' ').slice(0, 120)}`);
    await renderFrames(browser);
  } finally {
    browser?.close?.();
    await stopServer();
  }
}

/** Lays each screenshot into a captioned slide, then hands them to ffmpeg. */
async function renderFrames(browser) {
  rmSync(FRAMES, { recursive: true, force: true });
  mkdirSync(FRAMES, { recursive: true });
  const page = await browser.newPage();
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });

  for (const [index, shot] of shots.entries()) {
    await page.send('Page.navigate', { url: 'about:blank' });
    await sleep(120);
    await page.eval(`(() => {
      document.documentElement.innerHTML = ${JSON.stringify(slideHtml(shot, index + 1, shots.length))};
      return true;
    })()`);
    await sleep(320);
    const png = await page.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(FRAMES, `slide-${String(index + 1).padStart(2, '0')}.png`), Buffer.from(png.data, 'base64'));
  }
  page.close();
  encode();
}

function slideHtml(shot, index, total) {
  return `<head><meta charset="utf-8"></head><body style="margin:0;width:1280px;height:800px;background:#0e1014;color:#e9ebee;font:15px/1.5 ui-sans-serif,system-ui,sans-serif;display:flex;flex-direction:column">
  <div style="padding:22px 34px 14px;display:flex;align-items:baseline;gap:14px">
    <span style="font-size:11px;letter-spacing:.14em;color:#5f6672">${index} / ${total}</span>
    <h1 style="margin:0;font-size:23px;letter-spacing:-0.01em">${escapeHtml(shot.title)}</h1>
  </div>
  <p style="margin:0 34px 16px;color:#98a1b0;font-size:14.5px;max-width:1000px">${escapeHtml(shot.note)}</p>
  <div style="flex:1;min-height:0;margin:0 34px 30px;border:1px solid #252932;border-radius:12px;overflow:hidden;background:#000;display:flex;align-items:center;justify-content:center">
    <img src="data:image/png;base64,${shot.png}" style="max-width:100%;max-height:100%;object-fit:contain;display:block">
  </div>
</body>`;
}

const escapeHtml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** mp4 for a submission, gif for a README that has to play without a click. */
function encode() {
  const list = join(FRAMES, 'frames.txt');
  const lines = [];
  for (let index = 1; index <= shots.length; index++) {
    const file = `slide-${String(index).padStart(2, '0')}.png`;
    lines.push(`file '${file}'`, `duration ${index === shots.length ? 4.5 : 3.2}`);
  }
  lines.push(`file 'slide-${String(shots.length).padStart(2, '0')}.png'`);
  writeFileSync(list, lines.join('\n') + '\n');

  const mp4 = join(OUT, 'studio.mp4');
  const gif = join(OUT, 'studio.gif');
  const palette = join(FRAMES, 'palette.png');
  const run = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });

  run(['-f', 'concat', '-safe', '0', '-i', list, '-vf', 'scale=1280:-2:flags=lanczos,format=yuv420p', '-r', '12', mp4]);
  run(['-i', mp4, '-vf', 'fps=6,scale=900:-1:flags=lanczos,palettegen=stats_mode=diff', palette]);
  run(['-i', mp4, '-i', palette, '-lavfi', 'fps=6,scale=900:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3', gif]);
  rmSync(FRAMES, { recursive: true, force: true });

  const size = (path) => `${(readFileSync(path).length / 1024 / 1024).toFixed(2)} MB`;
  console.log(`\n  docs/demo/studio.mp4  ${size(mp4)}`);
  console.log(`  docs/demo/studio.gif  ${size(gif)}`);
}

mkdirSync(OUT, { recursive: true });
await main();
