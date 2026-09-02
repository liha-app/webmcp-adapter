/**
 * A very small CDP client. Chosen over puppeteer/playwright on purpose: the
 * point of this runner is to observe WebMCP through the DevTools protocol the
 * way an out-of-page agent would, with nothing in between that could paper over
 * a failure.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const CFT_APP = 'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

/**
 * Branded Google Chrome refuses `--load-extension` ("--load-extension is not
 * allowed in Google Chrome, ignoring"), so automated runs need Chrome for
 * Testing or Chromium. Manual acceptance in normal Chrome is unaffected: that
 * path uses chrome://extensions "Load unpacked".
 */
export function findChromeBinary() {
  const candidates = [];
  if (process.env.LIHA_CHROME) candidates.push(process.env.LIHA_CHROME);

  // `pnpm chrome:install` writes somewhere under .cache/chrome, and the shape of
  // that path is @puppeteer/browsers' business, not ours — it has already moved
  // once, from <version>/ to chrome/<platform>-<version>/, which left the
  // documented setup command installing a browser this function then ignored.
  // So walk down and look for the binary rather than predicting where it is.
  const localCache = join(process.cwd(), '.cache/chrome');
  const platformDirs = ['chrome-mac-arm64', 'chrome-mac-x64', 'chrome-linux64', 'chrome-linux'];
  const scan = (dir, depth) => {
    if (depth < 0 || !existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      if (platformDirs.includes(entry)) {
        candidates.push(join(dir, entry, CFT_APP));
        candidates.push(join(dir, entry, 'chrome'));
      } else {
        try {
          if (statSync(join(dir, entry)).isDirectory()) scan(join(dir, entry), depth - 1);
        } catch {
          /* unreadable entry */
        }
      }
    }
  };
  scan(localCache, 3);

  for (const pw of [join(homedir(), 'Library/Caches/ms-playwright'), join(homedir(), '.cache/ms-playwright')]) {
    if (!existsSync(pw)) continue;
    for (const entry of readdirSync(pw).filter((name) => name.startsWith('chromium-')).sort().reverse()) {
      candidates.push(join(pw, entry, 'chrome-mac-arm64', CFT_APP));
      candidates.push(join(pw, entry, 'chrome-mac', 'Chromium.app/Contents/MacOS/Chromium'));
      candidates.push(join(pw, entry, 'chrome-linux/chrome'));
      candidates.push(join(pw, entry, 'chrome-linux64/chrome'));
    }
  }

  const found = candidates.find((path) => path && existsSync(path));
  if (!found) {
    throw new Error(
      'No Chrome for Testing binary found.\n' +
        'Install one with:  pnpm chrome:install\n' +
        'or point LIHA_CHROME at a Chromium build that permits --load-extension.',
    );
  }
  return found;
}

export class Browser {
  constructor({ binary, flags = [], extensionPath = null, headless = true, webmcp = true }) {
    this.binary = binary;
    // Opt out to observe how a page behaves in a browser without WebMCP —
    // the degradation path is worth testing, not just assuming.
    this.webmcp = webmcp;
    // Port 0 lets Chrome choose, and the real port is read back from the
    // profile's DevToolsActivePort file. Hard-coding 9222 silently connects to
    // whatever other browser already owns that port.
    this.port = null;
    this.flags = flags;
    this.extensionPath = extensionPath;
    this.headless = headless;
    this.profile = mkdtempSync(join(tmpdir(), 'liha-acceptance-'));
    this.output = '';
  }

  launch() {
    const args = [
      ...(this.headless ? ['--headless=new'] : []),
      '--remote-debugging-port=0',
      `--user-data-dir=${this.profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      // Ephemeral acceptance profiles do not need the user's login Keychain.
      // This also prevents macOS password prompts from stealing focus.
      ...(process.platform === 'darwin' ? ['--use-mock-keychain'] : []),
      '--disable-background-networking',
      '--disable-sync',
      // Containerised CI runners restrict the user namespaces Chrome's sandbox
      // needs and mount a /dev/shm too small for it to start. Relaxed only
      // there — never on a developer's machine, where the sandbox is the
      // browser's main defence and these runs load an unpacked extension.
      ...(process.platform === 'linux' && process.env.CI
        ? ['--no-sandbox', '--disable-dev-shm-usage']
        : []),
      // The WebMCP API itself, plus the DevTools domain an inspector speaks.
      //
      // The off switch is not the mirror of the on switch, and assuming it was
      // made `webmcp: false` a no-op for a long time: Chrome for Testing has
      // WebMCP on by compile-time default, `--disable-blink-features=WebMCPTesting`
      // does not take it away, and every run that meant to observe a browser
      // without WebMCP was quietly observing one with it. `--disable-features`
      // reaches the base feature and does.
      ...(this.webmcp
        ? ['--enable-blink-features=WebMCPTesting,DevToolsWebMCPSupport']
        : ['--disable-features=WebMCP']),
      ...(this.extensionPath
        ? [`--load-extension=${this.extensionPath}`, `--disable-extensions-except=${this.extensionPath}`]
        : []),
      ...this.flags,
      'about:blank',
    ];
    this.proc = spawn(this.binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    this.proc.stdout.on('data', (chunk) => (this.output += chunk));
    this.proc.stderr.on('data', (chunk) => (this.output += chunk));
    return this;
  }

  async ready() {
    const portFile = join(this.profile, 'DevToolsActivePort');
    for (let attempt = 0; attempt < 150; attempt++) {
      if (existsSync(portFile)) {
        const port = Number(readFileSync(portFile, 'utf8').split('\n')[0]);
        if (Number.isInteger(port) && port > 0) {
          this.port = port;
          try {
            const response = await fetch(`http://127.0.0.1:${port}/json/version`);
            if (response.ok) return await response.json();
          } catch {
            /* handshake not ready yet */
          }
        }
      }
      await sleep(200);
    }
    throw new Error(`Chrome did not expose a debugging port.\n${this.output.slice(-2000)}`);
  }

  async targets() {
    const response = await fetch(`http://127.0.0.1:${this.port}/json/list`);
    return await response.json();
  }

  async waitForTarget(predicate, timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const target = (await this.targets()).find(predicate);
      if (target) return target;
      if (Date.now() > deadline) return null;
      await sleep(200);
    }
  }

  async newPage() {
    const response = await fetch(`http://127.0.0.1:${this.port}/json/new?about:blank`, { method: 'PUT' });
    const target = await response.json();
    return await new Session(target.webSocketDebuggerUrl).open();
  }

  async firstPage() {
    const target = await this.waitForTarget((candidate) => candidate.type === 'page');
    if (!target) throw new Error('no page target');
    return await new Session(target.webSocketDebuggerUrl).open();
  }

  close() {
    try {
      this.proc?.kill('SIGKILL');
    } catch {
      /* already gone */
    }
    try {
      rmSync(this.profile, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
}

/**
 * The Liha extension's id, read from its service worker target.
 *
 * Matched on the exact script name: a browser ships component extensions of its
 * own, and picking "the first chrome-extension:// target" finds one of those.
 */
export async function findExtensionId(browser, timeoutMs = 20000) {
  const target = await browser.waitForTarget(
    (candidate) => candidate.type === 'service_worker' && candidate.url.endsWith('/service-worker.js'),
    timeoutMs,
  );
  return target ? target.url.split('/')[2] : null;
}

export class Session {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = [];
  }

  async open() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result);
      } else if (message.method) {
        for (const listener of this.listeners) listener(message);
      }
    });
    return this;
  }

  on(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((candidate) => candidate !== listener);
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async goto(url) {
    await this.send('Page.enable');
    const loaded = new Promise((resolve) => {
      const off = this.on((message) => {
        if (message.method === 'Page.loadEventFired') {
          off();
          resolve();
        }
      });
      setTimeout(resolve, 20000);
    });
    await this.send('Page.navigate', { url });
    await loaded;
  }

  async reload() {
    const loaded = new Promise((resolve) => {
      const off = this.on((message) => {
        if (message.method === 'Page.loadEventFired') {
          off();
          resolve();
        }
      });
      setTimeout(resolve, 20000);
    });
    await this.send('Page.reload');
    await loaded;
  }

  async eval(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    }
    return result.result?.value;
  }

  close() {
    try {
      this.ws?.close();
    } catch {
      /* already closed */
    }
  }
}
