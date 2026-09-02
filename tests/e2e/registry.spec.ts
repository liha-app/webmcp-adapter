import { expect, test } from '@playwright/test';
import { PROOF } from '../../apps/registry/src/lib/proof';
import { en } from '../../apps/registry/src/i18n/en';
import { ja } from '../../apps/registry/src/i18n/ja';

test.describe('Landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5280/');
  });

  // A judge has to understand the idea before they will install anything, so
  // the claim and the three ways in are checked explicitly.
  test('states the claim and offers the three ways in', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Make any website agent-ready.');
    await expect(page.getByText('Add WebMCP tools to websites that never implemented WebMCP.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Try the demo' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Install the extension' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'View on GitHub' }).first()).toHaveAttribute(
      'href',
      'https://github.com/liha-app/webmcp-adapter',
    );
  });

  // The centrepiece. It has to actually call the page's own tools, and it has
  // to be truthful about which path executed the call.
  test('really runs this page’s own WebMCP tools', async ({ page }) => {
    const live = page.getByTestId('live-tools');
    await expect(live).toBeVisible();
    await expect(live.getByRole('tab')).toHaveCount(6);

    await live.getByRole('button', { name: 'Run search_adapters' }).click();
    const result = page.getByTestId('live-result');
    await expect(result).toBeVisible();
    // A real answer from the real catalogue, not a canned string.
    await expect(result).toContainText('demo-crm');
    await expect(result).toContainText('adapter(s)');
  });

  test('says which path executed the call, and does not pretend', async ({ page }) => {
    // Playwright's Chromium has no WebMCP, so the honest label here is the
    // direct one. The WebMCP path is covered by the acceptance runner, which
    // drives a browser that does expose the API.
    const hasWebMcp = await page.evaluate(() => 'modelContext' in document);
    await page.getByRole('button', { name: /^Run / }).click();
    await expect(page.getByTestId('live-result')).toBeVisible();
    await expect(page.locator('.live__badge')).toHaveText(
      hasWebMcp ? 'executed through WebMCP' : 'executed directly',
    );
    if (!hasWebMcp) {
      await expect(page.getByText(/your browser has no WebMCP/)).toBeVisible();
    }
  });

  test('switching tools swaps the arguments and clears the last result', async ({ page }) => {
    await page.getByRole('button', { name: /^Run / }).click();
    await expect(page.getByTestId('live-result')).toBeVisible();
    await page.getByRole('tab', { name: 'get_adapter', exact: true }).click();
    await expect(page.getByTestId('live-result')).toHaveCount(0);
    await expect(page.locator('.live__form input').first()).toHaveValue('demo-crm');
    await page.getByRole('button', { name: 'Run get_adapter' }).click();
    await expect(page.getByTestId('live-result')).toContainText('create_customer');
  });

  test('validate_adapter really rejects a wildcard origin', async ({ page }) => {
    await page.getByRole('tab', { name: 'validate_adapter' }).click();
    await page.getByRole('button', { name: 'Run validate_adapter' }).click();
    await expect(page.getByTestId('live-result')).toContainText('Not valid');
    await expect(page.getByTestId('live-result')).toContainText('wildcards');
  });

  test('explains the problem it exists to solve', async ({ page }) => {
    await expect(page.getByText('WebMCP adoption shouldn’t have to wait for every website owner.')).toBeVisible();
    await expect(page.getByText('registerTool()').first()).toBeVisible();
  });

  // Read from the same constant the page renders, so a suite that grows cannot
  // leave a stale number on the public page with the test still green.
  test('shows what has actually been verified', async ({ page }) => {
    for (const run of PROOF.acceptance) {
      await expect(page.getByText(run.result, { exact: true })).toBeVisible();
      await expect(page.getByText(en[run.nameKey], { exact: true })).toBeVisible();
    }
    // The two figures are fact tiles now; both still come from the constant.
    await expect(page.getByText(String(PROOF.unitAndIntegrationTests), { exact: true })).toBeVisible();
    await expect(page.getByText(/^unit and integration tests\./)).toBeVisible();
    await expect(page.getByText(String(PROOF.e2eTests), { exact: true })).toBeVisible();
    await expect(page.getByText(/^end-to-end tests in a real browser/)).toBeVisible();
    await expect(page.getByText(en['verified.fact5'])).toBeVisible();
  });

  test('shows a real adapter definition rather than describing one', async ({ page }) => {
    const excerpt = page.locator('.excerpt pre');
    await expect(excerpt).toContainText('"capability": "WRITE"');
    await expect(excerpt).toContainText('"type": "click"');
    const text = (await excerpt.textContent()) ?? '';
    expect(text).not.toMatch(/function\s*\(|=>|eval\(/);
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

  test('tells a first-time visitor exactly what to switch on', async ({ page }) => {
    await expect(page.getByText('chrome://flags/#enable-webmcp-testing').first()).toBeVisible();
    await expect(page.locator('[data-testid="setup-steps"] li')).toHaveCount(6);
    await expect(page.getByRole('link', { name: 'Download extension' })).toHaveAttribute('href', /releases/);
  });

  test('describes the recorder as a human workflow, not AI guesswork', async ({ page }) => {
    await expect(page.getByText('Teach an agent by using the website yourself.')).toBeVisible();
    await expect(page.getByText(/does not let an AI guess/)).toBeVisible();
    await expect(page.locator('[data-testid="recorder-steps"] li')).toHaveCount(6);
  });

  // "Safe" would be a claim this project cannot make; the limitation has to be
  // on the page, not only in the repository.
  test('is honest about the MAIN-world limitation', async ({ page }) => {
    await expect(page.getByText('Auditable, origin-scoped and permission-aware.')).toBeVisible();
    await expect(page.getByText(/The limitation we can’t engineer away/)).toBeVisible();
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
    await expect(page).toHaveTitle('Liha WebMCP Adapter — Make any website agent-ready');
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /Make any website agent-ready/);
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
    await expect(page.getByText(ja['security.limitTitle'])).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(ja['hero.headline']);
  });

  test('a Japanese browser gets Japanese without being asked', async ({ browser }) => {
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
    await expect(page.locator('.live__desc').first()).toContainText('Search the Liha adapter registry');
    await page.getByRole('button', { name: /search_adapters/ }).click();
    await expect(page.getByTestId('live-result')).toContainText('adapter(s)');
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

  test('says plainly when WebMCP is unavailable rather than pretending', async ({ page }) => {
    await expect(page.getByRole('status')).toContainText(/WebMCP is not available|implements WebMCP itself/);
  });

  test('install without the extension reports the truth', async ({ page }) => {
    await page.goto('http://localhost:5280/adapters/demo-crm');
    await expect(page.getByText('The extension will show you the permissions before installing.')).toBeVisible();
  });
});
