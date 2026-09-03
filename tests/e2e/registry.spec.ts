import { expect, test } from '@playwright/test';
import { PROOF } from '../../apps/registry/src/lib/proof';
import { en } from '../../apps/registry/src/i18n/en';
import { ja } from '../../apps/registry/src/i18n/ja';

test.describe('Landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5280/');
  });

  // A judge has to understand the idea before they will install anything.
  test('states the claim and offers clear demo, build and source paths', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(en['hero.headline']);
    await expect(page.getByText('Add WebMCP tools to websites that never implemented WebMCP.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Try the demo' }).first()).toHaveAttribute(
      'href',
      '/adapters/demo-crm',
    );
    await expect(page.getByRole('link', { name: 'Build one' }).first()).toHaveAttribute('href', '/create');
    await expect(page.getByRole('link', { name: 'View on GitHub' }).first()).toHaveAttribute(
      'href',
      'https://github.com/liha-app/webmcp-adapter',
    );
  });

  test('keeps WebMCP working without turning the landing page into an inspector', async ({ page }) => {
    const hasWebMcp = await page.evaluate(() => 'modelContext' in document);
    if (hasWebMcp) {
      await expect(page.getByTestId('webmcp-status')).toContainText('8 tools');
      const names = await page.evaluate(async () => {
        const mc = (document as Document & {
          modelContext?: { getTools(): Promise<Array<{ name: string }>> };
        }).modelContext;
        return mc ? (await mc.getTools()).map((tool) => tool.name) : [];
      });
      expect(names).toContain('search_adapters');
      expect(names).toContain('install_adapter');
    } else {
      await expect(page.getByTestId('webmcp-status')).toContainText('WebMCP is not available');
    }
    await expect(page.getByTestId('live-tools')).toHaveCount(0);
  });

  test('explains the problem it exists to solve', async ({ page }) => {
    await expect(page.getByText(en['problem.headline'])).toBeVisible();
    await expect(page.getByText('registerTool()').first()).toBeVisible();
  });

  test('shows concise implementation evidence', async ({ page }) => {
    await expect(page.getByText('Published adapters', { exact: true })).toBeVisible();
    await expect(page.getByText('Adapter tools', { exact: true })).toBeVisible();
    await expect(page.getByText(String(PROOF.unitAndIntegrationTests), { exact: true })).toBeVisible();
    await expect(page.getByText(String(PROOF.e2eTests), { exact: true })).toBeVisible();
  });

  test('moves detailed adapter definitions to the adapter product page', async ({ page }) => {
    await expect(page.locator('.excerpt')).toHaveCount(0);
    await page.goto('http://localhost:5280/adapters/demo-crm');
    await expect(page.getByRole('button', { name: 'Show full definition' })).toBeVisible();
  });

  test('links to all three demos with their tools and capabilities', async ({ page }) => {
    const demos = page.locator('[data-testid="demo-list"] li');
    await expect(demos).toHaveCount(3);
    await expect(page.getByRole('link', { name: 'Open Acme CRM' })).toHaveAttribute('href', /5273|crm\./);
    await expect(page.getByRole('link', { name: 'Open Nimbus Supply' })).toHaveAttribute('href', /5274|shop\./);
    await expect(page.getByRole('link', { name: 'Open Kite Project Manager' })).toHaveAttribute('href', /5275|project\./);
    await expect(demos.filter({ hasText: 'Kite' }).getByText('DESTRUCTIVE confirmation')).toBeVisible();
    // Every lockup carries its own icon, which is the store layout's unit.
    await expect(demos.locator('.appicon svg')).toHaveCount(3);
  });

  test('moves setup instructions to the guided build', async ({ page }) => {
    await expect(page.locator('[data-testid="setup-steps"]')).toHaveCount(0);
    await page.getByRole('link', { name: 'Build one' }).first().click();
    await expect(page).toHaveURL(/\/create$/);
    await expect(page.getByText('chrome://flags/#enable-webmcp-testing').first()).toBeVisible();
  });

  test('describes the recorder as a human workflow, not AI guesswork', async ({ page }) => {
    await expect(page.getByText('Teach an agent by using the website yourself.')).toBeVisible();
    await expect(page.getByText(en['recorder.copy'])).toBeVisible();
    await expect(page.locator('#create .flow__node')).toHaveCount(3);
  });

  // "Safe" would be a claim this project cannot make; the limitation has to be
  // on the page, not only in the repository.
  test('is honest about the MAIN-world limitation', async ({ page }) => {
    await expect(page.getByText('Auditable, origin-scoped and permission-aware.')).toBeVisible();
    await expect(page.getByText(/runtime must live in the page’s JavaScript world/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Read the full threat model' })).toHaveAttribute(
      'href',
      /SECURITY\.md$/,
    );
  });

  test('closes with the argument', async ({ page }) => {
    await expect(page.getByText('Don’t wait for every website to adopt WebMCP.')).toBeVisible();
    await expect(page.getByText('The website never implemented WebMCP. Liha Adapter did.')).toBeVisible();
  });

  test('carries share metadata', async ({ page }) => {
    await expect(page).toHaveTitle(en['meta.title']);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /Make websites agent-ready/);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.svg');
  });
});


test.describe('Appearance and language', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5280/');
  });

  // The point of the control is that it beats the operating system, in both
  // directions — otherwise someone on a dark Mac can never see the light one.
  test('an explicit appearance overrides the operating system', async ({ page }) => {
    const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const control = page.getByTestId('theme-control');

    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);

    await control.locator('[data-theme-option="dark"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await background()).toBe('rgb(0, 0, 0)');

    await control.locator('[data-theme-option="light"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await background()).toBe('rgb(255, 255, 255)');

    await control.locator('[data-theme-option="auto"]').click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
  });

  test('the appearance survives a reload, without flashing the wrong one', async ({ page }) => {
    await page.getByTestId('theme-control').locator('[data-theme-option="dark"]').click();
    await page.reload({ waitUntil: 'commit' });
    // Read before the app has mounted: the inline script must have run already.
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('switching language translates the page and sets lang', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(en['hero.headline']);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await page.getByTestId('language-control').locator('[data-locale-option="ja"]').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(ja['hero.headline']);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    await expect(page).toHaveTitle(ja['meta.title']);
    await expect(page.getByText(ja['security.limitShort'])).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(ja['hero.headline']);
  });

  test('a Japanese browser gets Japanese without being asked', async ({ browser }) => {
    /*
     * This one opens a second browser context on top of the one the fixture
     * already gave it, so the worker is rendering two copies of the landing
     * page — hero canvas and all — while every other worker renders its own.
     * It is the test that tips over first under a full parallel run, and it is
     * doing genuinely more work than the others rather than being flaky.
     */
    test.slow();
    const context = await browser.newContext({ locale: 'ja-JP' });
    const page = await context.newPage();
    await page.goto('http://localhost:5280/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(ja['hero.headline']);
    await context.close();
  });

  // The tools are read by models and asserted by the acceptance suite, so they
  // must not follow the interface language.
  test('the WebMCP tools stay in one language whatever the page is showing', async ({ page }) => {
    await page.getByTestId('language-control').locator('[data-locale-option="ja"]').click();
    const hasWebMcp = await page.evaluate(() => 'modelContext' in document);
    if (hasWebMcp) {
      await expect(page.getByTestId('webmcp-status')).toContainText('8個');
      const names = await page.evaluate(async () => {
        const mc = (document as Document & {
          modelContext?: { getTools(): Promise<Array<{ name: string }>> };
        }).modelContext;
        return mc ? (await mc.getTools()).map((tool) => tool.name) : [];
      });
      expect(names).toContain('search_adapters');
      expect(names.some((name) => /[ぁ-んァ-ン一-龯]/.test(name))).toBe(false);
    } else {
      await expect(page.getByTestId('webmcp-status')).toContainText('このブラウザではWebMCPを利用できません');
    }
  });

  test('the store and the product page are translated too', async ({ page }) => {
    await page.getByTestId('language-control').locator('[data-locale-option="ja"]').click();
    await page.goto('http://localhost:5280/adapters');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(ja['store.title']);
    await expect(page.getByTestId('category-filter')).toContainText(ja['store.allAdapters']);
    await page.goto('http://localhost:5280/adapters/demo-project');
    await expect(page.getByText(ja['detail.reachTitle'])).toBeVisible();
    // Adapter-supplied text is the published definition, so it is not translated.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kite Project Manager');
  });
});

test.describe('The guided build', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5280/create');
  });

  test('lays out the whole path in order', async ({ page }) => {
    // Seven steps, one order. If a step is dropped the page still renders, so
    // the count is the assertion.
    await expect(page.locator('.build')).toHaveCount(7);
    await expect(page.getByRole('heading', { name: 'Turn WebMCP on' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Call it' })).toBeVisible();
  });

  test('says what is missing rather than assuming it is there', async ({ page }) => {
    // No extension is loaded in these runs, so the honest state is "not yet".
    await expect(page.getByRole('link', { name: 'Download the extension' })).toBeVisible();
    await expect(page.getByText('Once your adapter is installed')).toBeVisible();
  });

  test('hands over the flag when the browser has no WebMCP', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Document.prototype, 'modelContext', { configurable: true, get: () => undefined });
    });
    await page.goto('http://localhost:5280/create');
    // The status band names the flag too, so this is the one in the step —
    // together with the button that saves retyping it off a screenshot.
    await expect(page.locator('.build code', { hasText: 'enable-webmcp-testing' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy the flag URL' })).toBeVisible();
  });

  test('points at the demo the recorder can reach', async ({ page }) => {
    const open = page.getByRole('link', { name: /Open Nimbus Supply/ });
    await expect(open).toBeVisible();
    await expect(open).toHaveAttribute('href', 'http://localhost:5274');
  });
});

test.describe('Adapter Registry', () => {
  // The store layout: sidebar counts, a feature card, and shelves of lockups.
  test('presents the catalogue as a store with a filter sidebar', async ({ page }) => {
    await page.goto('http://localhost:5280/adapters');
    const sidebar = page.getByTestId('category-filter');
    await expect(sidebar.getByRole('button', { name: 'All adapters' })).toHaveAttribute('aria-current', 'true');
    // The counts beside each filter have to be real, not decoration.
    await expect(sidebar.getByRole('button', { name: 'All adapters' })).toContainText('3');
    await expect(page.locator('.featurecard')).toContainText('3 adapters');
    await expect(page.locator('[data-testid="adapter-list"] .appicon svg')).toHaveCount(3);
    // The demo shelf links straight at the running demo apps.
    await expect(page.getByRole('link', { name: 'Open' }).first()).toHaveAttribute('href', /5273|crm\./);
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5280/adapters');
  });

  test('lists the official adapters', async ({ page }) => {
    await expect(page.getByTestId('adapter-list').locator('li')).toHaveCount(3);
    await expect(page.getByTestId('result-count')).toHaveText('3 adapters');
  });

  test('filters by text, category and capability, and keeps it in the URL', async ({ page }) => {
    await page.getByTestId('adapter-search').fill('coupon');
    await expect(page.getByTestId('adapter-list').locator('li')).toHaveCount(1);
    await expect(page).toHaveURL(/q=coupon/);

    await page.getByTestId('adapter-search').fill('');
    await page.getByTestId('capability-filter').getByRole('button', { name: 'DESTRUCTIVE' }).click();
    await expect(page.getByTestId('adapter-list').locator('li')).toHaveCount(1);
    await expect(page.getByTestId('adapter-list')).toContainText('Kite Project Manager');
    await expect(page).toHaveURL(/capability=DESTRUCTIVE/);

    await page.getByTestId('capability-filter').getByRole('button', { name: 'Any capability' }).click();
    await page.getByTestId('category-filter').getByRole('button', { name: 'crm' }).click();
    await expect(page.getByTestId('adapter-list')).toContainText('Acme CRM');
  });

  test('shows a shareable filtered view', async ({ page }) => {
    await page.goto('http://localhost:5280/adapters?q=task');
    await expect(page.getByTestId('adapter-search')).toHaveValue('task');
    await expect(page.getByTestId('adapter-list').locator('li')).toHaveCount(1);
  });

  test('reports no results honestly', async ({ page }) => {
    await page.getByTestId('adapter-search').fill('zzzz');
    await expect(page.getByTestId('no-results')).toBeVisible();
  });

  // Auditability is the product argument: the definition must be readable
  // before install, not after.
  test('discloses origins, capabilities and the full source on the detail page', async ({ page }) => {
    await page.getByTestId('adapter-list').getByRole('link', { name: /Kite Project Manager/ }).click();
    await expect(page).toHaveURL(/\/adapters\/demo-project$/);
    await expect(page.getByText('http://localhost:5275')).toBeVisible();
    await expect(page.getByText('https://demo-project.liha.review')).toBeVisible();
    await expect(page.locator('[data-tool-name="delete_task"]')).toContainText('DESTRUCTIVE');
    await expect(page.getByText(/destructive tool/i)).toBeVisible();

    await page.getByRole('button', { name: 'Show full definition' }).click();
    const source = page.getByTestId('adapter-source');
    await expect(source).toBeVisible();
    const text = (await source.textContent()) ?? '';
    expect(text).toContain('"delete_task"');
    // An adapter cannot contain executable code, and the published source shows it.
    expect(text).not.toMatch(/function\s*\(|=>|eval\(/);
  });

  test('reports its own WebMCP status on the page', async ({ page }) => {
    await expect(page.getByTestId('webmcp-status')).toContainText(/WebMCP is not available|implements WebMCP itself/);
  });

  test('says plainly when WebMCP is unavailable rather than pretending', async ({ page }) => {
    /*
     * The alternation above passes whichever way the browser goes, so for a
     * long time the branch this test is named after was never reached: the
     * Chromium Playwright ships has WebMCP on, so every run took the supported
     * path and the honest-degradation copy went unchecked.
     *
     * Take the API away before the page loads instead of hoping for a browser
     * that lacks it. `detectModelContext` reads `document.modelContext`, so a
     * getter returning undefined is exactly what a browser without the flag
     * presents — which is what someone running branded Chrome sees.
     */
    await page.addInitScript(() => {
      Object.defineProperty(Document.prototype, 'modelContext', {
        configurable: true,
        get: () => undefined,
      });
    });
    await page.goto('http://localhost:5280/');
    await expect(page.getByTestId('webmcp-status')).toContainText('WebMCP is not available in this browser');
    await expect(page.getByTestId('webmcp-status')).toContainText('chrome://flags/#enable-webmcp-testing');
    // And it must not claim to have registered anything it could not register.
    await expect(page.getByTestId('webmcp-status')).not.toContainText('implements WebMCP itself');
  });

  test('install without the extension reports the truth', async ({ page }) => {
    await page.goto('http://localhost:5280/adapters/demo-crm');
    await expect(page.getByText('The extension will show you the permissions before installing.')).toBeVisible();
  });
});

test.describe('Onboard your agent', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('copies a sentence that points an agent at this origin', async ({ page }) => {
    await page.goto('http://localhost:5280/');
    const chip = page.locator('[data-action="copy-agent-prompt"]');
    await expect(chip).toBeVisible();
    await expect(page.getByTestId('onboard-status')).toHaveText('');

    await chip.click();
    await expect(page.getByTestId('onboard-status')).not.toHaveText('');

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toBe(
      'Fetch and execute the appropriate instructions to set me up for Liha WebMCP Adapter from http://localhost:5280/agent-setup/prompt.md',
    );
  });

  test('and that URL serves the document, not the app', async ({ page }) => {
    // A single-page app with a catch-all fallback will happily answer any path
    // with index.html. An agent following the sentence would then be reading
    // HTML and would have no idea why none of it made sense.
    const response = await page.request.get('http://localhost:5280/agent-setup/prompt.md');
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).not.toContain('<!doctype html');
    expect(body).toContain('# Onboard your agent to Liha WebMCP Adapter');
    expect(body).toContain('"capability": "READ"');
  });

  test('the chip sits above the eyebrow and never covers the headline', async ({ page }) => {
    await page.goto('http://localhost:5280/');
    const chip = (await page.locator('[data-action="copy-agent-prompt"]').boundingBox())!;
    const eyebrow = (await page.locator('.t-eyebrow-super').first().boundingBox())!;
    expect(chip.y + chip.height).toBeLessThanOrEqual(eyebrow.y + 1);
  });
});

test.describe('the tab icon', () => {
  test('is the mark, and the home-screen tile is the app icon', async ({ page }) => {
    await page.goto('http://localhost:5280/');
    // The two forms are not interchangeable and they were swapped once.
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.svg');
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      'href',
      '/brand/liha-adapter-icon.svg',
    );

    const favicon = await (await page.request.get('http://localhost:5280/favicon.svg')).text();
    const mark = await (
      await page.request.get('http://localhost:5280/brand/liha-adapter-mark.svg')
    ).text();
    expect(favicon).toBe(mark);
    // The mark carries the sparkle; the app icon drops it. Four paths, not three.
    expect([...favicon.matchAll(/<path/g)]).toHaveLength(4);
    expect(favicon).not.toContain('<rect');
  });

  test('the agent marks are served, and swap for the appearance', async ({ page }) => {
    await page.goto('http://localhost:5280/');
    for (const file of ['claude.svg', 'codex.svg', 'codex-dark.svg']) {
      const response = await page.request.get(`http://localhost:5280/brand/agents/${file}`);
      expect(response.status(), file).toBe(200);
    }
    await page.getByTestId('theme-control').locator('[data-theme-option="light"]').click();
    await expect(page.locator('.onboard__agent--light')).toBeVisible();
    await expect(page.locator('.onboard__agent--dark')).toBeHidden();
    await page.getByTestId('theme-control').locator('[data-theme-option="dark"]').click();
    await expect(page.locator('.onboard__agent--dark')).toBeVisible();
    await expect(page.locator('.onboard__agent--light')).toBeHidden();
  });
});

test.describe('Building an adapter by asking for one', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5280/create');
  });

  test('lays out the agent route above the recorder', async ({ page }) => {
    const panel = page.getByTestId('agent-build');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.agentflow > li')).toHaveCount(4);
    const agent = (await panel.boundingBox())!;
    const recorder = (await page.locator('.buildlist').boundingBox())!;
    expect(agent.y).toBeLessThan(recorder.y);
  });

  test('rejects a draft and says exactly why', async ({ page }) => {
    // The errors are the product here: an agent fixes what it is told about.
    await page.getByTestId('draft-json').fill(
      JSON.stringify({
        id: 'Bad Id',
        name: 'x',
        version: '1',
        origins: ['https://*.example.com'],
        tools: [],
      }),
    );
    await page.locator('[data-action="validate-draft"]').click();
    const result = page.getByTestId('draft-result');
    await expect(result).toContainText('kebab-case');
    await expect(result).toContainText('semver');
    await expect(result).toContainText('no wildcards');
    await expect(page.locator('[data-action="download-draft"]')).toBeDisabled();
    await expect(page.locator('[data-action="install-draft"]')).toBeDisabled();
  });

  test('catches the rules that are not just shape', async ({ page }) => {
    await page.getByTestId('draft-json').fill(
      JSON.stringify({
        id: 'demo',
        name: 'Demo',
        version: '1.0.0',
        origins: ['https://app.example.com'],
        tools: [
          {
            name: 'go_home',
            description: 'Reads the page.',
            capability: 'READ',
            inputSchema: { type: 'object', properties: {} },
            steps: [{ type: 'navigate', path: '/home' }],
          },
        ],
      }),
    );
    await page.locator('[data-action="validate-draft"]').click();
    // A READ tool may not navigate, and an agent has no way to know that from
    // the shape alone — which is exactly why it validates here.
    await expect(page.getByTestId('draft-result')).toContainText('declared READ');
  });

  test('accepts a good draft, and offers it back as a file', async ({ page }) => {
    await page.getByTestId('draft-json').fill(
      JSON.stringify({
        id: 'example-site',
        name: 'Example',
        version: '1.0.0',
        origins: ['https://app.example.com'],
        tools: [
          {
            name: 'find_issue',
            description: 'Search the issue list and return what matches.',
            capability: 'READ',
            inputSchema: {
              type: 'object',
              properties: { query: { type: 'string', description: 'What to search for' } },
              required: ['query'],
            },
            steps: [
              { type: 'fill', selector: "[data-testid='q']", value: '{{query}}' },
              { type: 'readList', selector: "[data-testid='issues'] li", as: 'issues' },
            ],
          },
        ],
      }),
    );
    // The verdict is read at a glance rather than in a sentence: what it is,
    // where it runs, the worst it can do, and one card per tool.
    const verdict = page.getByTestId('draft-result');
    await expect(verdict).toContainText('Example');
    await expect(verdict).toContainText('https://app.example.com');
    await expect(verdict.locator('.verdict__head .cap')).toHaveText('READ');
    await expect(verdict.locator('.toolcards li')).toHaveCount(1);
    await expect(verdict.locator('.toolcards__name')).toHaveText('find_issue');
    await expect(verdict.locator('.toolcards__steps')).toHaveText('2 steps');
    await expect(page.getByTestId('draft-state')).toHaveText('Valid');

    const [saved] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-action="download-draft"]').click(),
    ]);
    expect(saved.suggestedFilename()).toBe('example-site.json');
    const stream = await saved.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    expect(JSON.parse(Buffer.concat(chunks).toString()).tools[0].name).toBe('find_issue');
  });

  test('says the extension is missing rather than pretending to install', async ({ page }) => {
    await page.getByTestId('draft-json').fill(
      JSON.stringify({
        id: 'example-site',
        name: 'Example',
        version: '1.0.0',
        origins: ['https://app.example.com'],
        tools: [
          {
            name: 'read_it',
            description: 'Reads the page.',
            capability: 'READ',
            inputSchema: { type: 'object', properties: {} },
            steps: [{ type: 'readText', selector: 'h1', as: 'title' }],
          },
        ],
      }),
    );
    await page.locator('[data-action="validate-draft"]').click();
    await page.locator('[data-action="install-draft"]').click();
    // No extension in this browser, so the honest answer is that, not a spinner
    // that never resolves and not a claim that it worked.
    await expect(page.getByTestId('draft-install-result')).toContainText(/extension/i, { timeout: 20_000 });
  });
});

test.describe('The Studio bench', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5280/create');
  });

  test('checks the draft as you type, without being asked', async ({ page }) => {
    // A validator you have to ask is a form. This one answers while you work.
    await expect(page.getByTestId('draft-state')).toHaveText('Paste a draft');
    await page.getByTestId('draft-json').fill('{ not json');
    await expect(page.getByTestId('draft-state')).toContainText('problem', { timeout: 5000 });
    await expect(page.locator('.editor')).toHaveAttribute('data-state', 'bad');
  });

  test('the pipeline follows the work rather than a click', async ({ page }) => {
    const stages = page.locator('.agentflow > li');
    await expect(stages).toHaveCount(4);
    await expect(stages.nth(0)).toHaveAttribute('data-active', 'true');

    await page.getByTestId('draft-json').fill('{');
    await expect(stages.nth(2)).toHaveAttribute('data-active', 'true');
    await expect(stages.nth(0)).toHaveAttribute('data-done', 'true');

    await page.getByTestId('draft-json').fill(
      JSON.stringify({
        id: 'x-site',
        name: 'X',
        version: '1.0.0',
        origins: ['https://app.example.com'],
        tools: [
          {
            name: 'read_it',
            description: 'Reads the page.',
            capability: 'READ',
            inputSchema: { type: 'object', properties: {} },
            steps: [{ type: 'readText', selector: 'h1', as: 'title' }],
          },
        ],
      }),
    );
    await expect(stages.nth(3)).toHaveAttribute('data-active', 'true', { timeout: 5000 });
  });

  test('the rail reports the browser rather than assuming it', async ({ page }) => {
    // No extension and no WebMCP in this browser, and the bench says so instead
    // of showing two hopeful ticks.
    const rail = page.getByTestId('bench-rail');
    await expect(rail.locator('.lamp')).toHaveCount(2);
    await expect(rail.locator('.lamp[data-state="on"]')).toHaveCount(0);
    await expect(rail.locator('.lamp[data-state="off"]')).toHaveCount(2, { timeout: 10_000 });
  });

  test('the download link is reachable to a click but not to the eye', async ({ page }) => {
    // It was visible for one build, sitting next to the buttons as a stray link.
    const link = page.locator('.editor__foot a.offscreen');
    await expect(link).toHaveCount(1);
    const box = await link.boundingBox();
    expect(box!.width).toBeLessThan(3);
    expect(box!.height).toBeLessThan(3);
  });
});

test.describe('The Studio’s own onboarding chip', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('hands over the setup and the job in one paste', async ({ page }) => {
    await page.goto('http://localhost:5280/create');
    const chip = page.locator('[data-action="copy-agent-prompt"]');
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('Adapter Studio');

    await chip.click();
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    // The same sentence the landing hands out, plus what to do with it — one
    // control rather than the two this page used to carry.
    expect(clipboard).toContain('http://localhost:5280/agent-setup/prompt.md');
    expect(clipboard).toContain('build me an adapter');
    expect(clipboard.split('\n\n')).toHaveLength(2);
  });

  test('is the only copy control on the page', async ({ page }) => {
    await page.goto('http://localhost:5280/create');
    await expect(page.locator('[data-action="copy-starter"]')).toHaveCount(0);
    await expect(page.locator('[data-action="copy-agent-prompt"]')).toHaveCount(1);
  });
});

test.describe('The extension download link', () => {
  test('carries the mark of where it goes, and swaps it for the appearance', async ({ page }) => {
    await page.goto('http://localhost:5280/create');
    const link = page.locator('.outlink');
    await expect(link).toHaveAttribute('href', /github\.com\/.+\/releases/);
    for (const file of ['github.svg', 'github-dark.svg']) {
      expect((await page.request.get(`http://localhost:5280/brand/vendors/${file}`)).status(), file).toBe(200);
    }

    await page.getByTestId('theme-control').locator('[data-theme-option="light"]').click();
    await expect(link.locator('.outlink__mark--light')).toBeVisible();
    await expect(link.locator('.outlink__mark--dark')).toBeHidden();
    await page.getByTestId('theme-control').locator('[data-theme-option="dark"]').click();
    await expect(link.locator('.outlink__mark--dark')).toBeVisible();
    await expect(link.locator('.outlink__mark--light')).toBeHidden();
  });
});
