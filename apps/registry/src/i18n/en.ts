/**
 * The English strings, and the source of truth for the key set.
 *
 * `{0}`, `{1}`… are filled by `t()` (plain values) or `tx()` (React nodes,
 * for the inline <code> spans). Keys are grouped by where they appear.
 */
export const en = {
  'meta.title': 'Liha WebMCP Adapter — Make any website agent-ready',
  'meta.description':
    'Add auditable WebMCP tools to websites that never implemented WebMCP. Declarative, origin-scoped, open source.',

  /* ------------------------------------------------------------- chrome -- */
  'nav.adapters': 'Adapters',
  'nav.how': 'How it works',
  'nav.trust': 'Trust model',
  'nav.github': 'GitHub',
  'nav.appearance': 'Appearance',
  'nav.themeAuto': 'Auto',
  'nav.themeLight': 'Light',
  'nav.themeDark': 'Dark',
  'nav.language': 'Language',

  'status.checking': 'Checking for WebMCP…',
  'status.supported': 'This site implements WebMCP itself — {0} tools registered: {1}',
  'status.unsupported':
    'WebMCP is not available in this browser. Enable chrome://flags/#enable-webmcp-testing to let an agent use this page directly.',

  'footer.readable':
    'Every adapter here is a JSON file in the repository. Adapters contain no JavaScript — read one before you install it.',
  'footer.mainWorld':
    'The runtime that registers these tools lives in the page’s own JavaScript world, which is the only place WebMCP can be reached. A hostile page can see it. That trade-off is documented rather than hidden.',
  'footer.mit': 'MIT licensed',
  'footer.source': 'Source',
  'footer.security': 'Security',
  'footer.format': 'Adapter format',
  'footer.apiNotes': 'WebMCP API notes',
  'footer.disclaimer':
    'Not affiliated with, endorsed by or connected to Apple Inc. or the App Store. The layout follows Apple’s public design conventions; all names, artwork and copy here are this project’s own.',

  /* --------------------------------------------------------------- hero -- */
  'hero.eyebrow': 'Liha WebMCP Adapter',
  'hero.headline': 'Make any website agent-ready.',
  'hero.copy': 'Add WebMCP tools to websites that never implemented WebMCP.',
  'hero.tryDemo': 'Try the demo',
  'hero.install': 'Install the extension',
  'hero.github': 'View on GitHub',
  'hero.note':
    'Chrome 151+ with the WebMCP flag on. Open source, MIT licensed, and every adapter is readable before you install it.',

  /* --------------------------------------------------------- live panel -- */
  'live.headline': 'This page has WebMCP tools. Call one.',
  'live.copy':
    'The registry implements WebMCP natively — this is what a site looks like when its own developers do the work. Pick a tool, press run, and the answer below comes from the real catalogue. When your browser has the API, the call really goes through {0}; when it does not, the panel says so rather than pretending.',
  'live.factRegisteredFigure': '{0} tools',
  'live.factRegisteredLabel':
    'registered by this page on load, discoverable by any WebMCP agent — with their input schemas.',
  'live.factZeroFigure': '0 tools',
  'live.factZeroLabel':
    'registered by the three demo apps. They contain no WebMCP code at all; their tools arrive from adapters, from outside.',
  'live.browseAdapters': 'Browse the adapters',
  'live.asAgentSees': 'the tool exactly as an agent receives it',
  'live.noArgs': 'This tool takes no arguments.',
  'live.run': 'Run {0}',
  'live.running': 'Running…',
  'live.willRunWebmcp': 'will run through document.modelContext',
  'live.willRunDirect': 'your browser has no WebMCP — this will run the same function directly',
  'live.executedWebmcp': 'executed through WebMCP',
  'live.executedDirect': 'executed directly',

  /* ------------------------------------------------------------ problem -- */
  'problem.headline': 'WebMCP adoption shouldn’t have to wait for every website owner.',
  'problem.p1':
    'A site becomes agent-ready when its developers ship {0}. That is a good standard and a slow one: until it happens, an agent is back to screenshots and guesswork on every site that has not got round to it — which is most of them.',
  'problem.p2':
    'An adapter moves the work. The capability is defined by whoever needs it, published as readable JSON, and installed by the person whose browser it runs in. The site is unchanged and unaware.',
  'problem.today': 'Today',
  'problem.withAdapter': 'With an adapter',
  'problem.factNoChangeFigure': 'No change',
  'problem.factNoChangeLabel':
    'to the target website. No SDK, no script tag, no cooperation from its owner, no account.',
  'problem.factYourCallFigure': 'Your call',
  'problem.factYourCallLabel':
    'An adapter runs because you installed it, on the origins it names, after the extension showed you what it can reach.',

  'flow.websiteDeveloper': 'Website developer',
  'flow.registerTool': 'registerTool()',
  'flow.agent': 'Agent',
  'flow.existingWebsite': 'Existing website',
  'flow.communityAdapter': 'Community adapter',
  'flow.extension': 'Extension',
  'flow.webmcpAgent': 'WebMCP agent',

  /* ------------------------------------------------------------ adapter -- */
  'adapter.headline': 'An adapter is a JSON file, and that is the whole point.',
  'adapter.copy':
    'The step vocabulary is closed — click, fill, select, waitFor and a handful more. There is no {0} step, no expression language and no way to express one, which is what makes a registry of community-contributed adapters something you can reason about rather than a malware channel. These are the first {1} steps of a real tool, unedited:',
  'adapter.noteCapabilityLabel': 'capability',
  'adapter.noteCapability':
    'is declared per tool. DESTRUCTIVE always asks the user first; WRITE can be set to.',
  'adapter.noteStepsLabel': 'steps',
  'adapter.noteSteps':
    'name one element each. If a selector matches zero or five elements the call fails rather than guessing which button to press.',
  'adapter.notePlaceholdersLabel': '{{placeholders}}',
  'adapter.notePlaceholders':
    'interpolate into values, never into selectors — a tool argument cannot retarget a step.',
  'adapter.noteRestLabel': 'The rest',
  'adapter.noteRest':
    'of this tool is {0} read steps that look up the customer it just created, so the tool can report what it actually made rather than assuming it worked.',
  'adapter.seeWhole': 'See the whole adapter',
  'adapter.readFormat': 'Read the full format',

  /* ----------------------------------------------------------------- how -- */
  'how.headline': 'How it reaches the page',
  'how.copy':
    'The extension validates the adapter, then injects a small runtime into the page’s own JavaScript world — the only place {0} can be reached — and registers each tool there. Your agent sees an ordinary WebMCP tool. When it calls one, the adapter’s steps drive the site’s real form, so the app’s own logic runs exactly as it would for a person.',
  'how.stepAdapterJson': 'Adapter JSON',
  'how.stepAdapterJsonDetail': 'declarative, origin-scoped',
  'how.stepExtension': 'Chrome extension',
  'how.stepExtensionDetail': 'validates, then injects',
  'how.stepMainWorld': 'MAIN world',
  'how.stepMainWorldDetail': 'the page’s own JavaScript world',
  'how.stepRegister': 'registerTool()',
  'how.stepRegisterDetail': 'document.modelContext',
  'how.stepAgent': 'Agent',
  'how.stepAgentDetail': 'discovers named capabilities',
  'how.notAutomationTitle': 'This is not browser automation with extra steps.',
  'how.notAutomationCopy':
    'Automation re-derives what to click on every run, is hard to audit, and has no notion of permission. The output here is not a click — it is a named capability with a JSON input schema, a capability classification, and a workflow written once and reviewable by anyone.',
  'how.factStepsFigure': '{0} steps',
  'how.factStepsLabel':
    'is the entire vocabulary — {0} and {1} more. Nothing in it can execute code, so there is no version of an adapter that runs a script you did not read.',

  /* --------------------------------------------------------------- demos -- */
  'demos.headline': 'Three ordinary web apps with zero WebMCP code.',
  'demos.copy':
    '{0} adapters, {1} tools. That the apps implement nothing is asserted against their sources, their built bundles and the live page — if someone slipped a {2} into one of them, CI would fail.',
  'demos.open': 'Open {0}',
  'demos.adapter': 'Adapter',
  'demos.blurbCrm': 'A customer list with an add-and-edit dialog. Ordinary CRUD, ordinary React.',
  'demos.blurbShop': 'A storefront with search, a cart and coupon codes. No checkout, by design.',
  'demos.blurbProject':
    'Tasks with assignees and statuses — including a delete, so you can watch a destructive tool ask first.',
  'demos.noteProject': 'Use this one to see the DESTRUCTIVE confirmation.',

  /* --------------------------------------------------------------- setup -- */
  'setup.headline': 'Before the demos will do anything.',
  'setup.copy': 'WebMCP is behind a flag in Chrome today, so there is one switch to turn on first.',
  'setup.step1': 'Use Google Chrome 151 or newer.',
  'setup.step2': 'Enable the WebMCP flag and relaunch.',
  'setup.step3': 'Load the extension: download it, unzip, then Load unpacked at chrome://extensions with Developer mode on.',
  'setup.step4': 'Open one of the demos below.',
  'setup.step5': 'Check the Liha popup — the adapter should be enabled and its tools registered.',
  'setup.step6': 'Ask your WebMCP agent to do something, for example “create a customer named Alice Smith”.',
  'setup.download': 'Download extension',
  'setup.buildFromSource': 'Or build from source',

  /* ------------------------------------------------------------ recorder -- */
  'recorder.headline': 'Teach an agent by using the website yourself.',
  'recorder.copy':
    'The recorder does not let an AI guess at a page and invent an adapter. It watches a workflow a person performed and turns it into a declarative capability you review before it becomes a tool — selectors come from the site’s own stable attributes, never class names, and the values you typed become inputs rather than being baked in.',
  'recorder.step1Title': 'Record',
  'recorder.step1': 'Press record in the extension popup.',
  'recorder.step2Title': 'Use the website',
  'recorder.step2': 'Click and type the way you normally would.',
  'recorder.step3Title': 'Review the steps',
  'recorder.step3': 'Each selector is shown with how many elements it matched.',
  'recorder.step4Title': 'Parameterize',
  'recorder.step4': 'What you typed becomes tool input, with your text kept as the example.',
  'recorder.step5Title': 'Test selectors',
  'recorder.step5': 'Checked against the live page for a single match.',
  'recorder.step6Title': 'Install',
  'recorder.step6': 'It becomes a WebMCP tool, after you approve what it can reach.',

  /* ------------------------------------------------------------ verified -- */
  'verified.headline': 'What has actually been checked.',
  'verified.copy':
    'A real agent, outside the page, discovers and invokes these tools through the DevTools WebMCP domain — the same surface a Tool Inspector uses. {0}',
  'verified.ciNote': 'Every push runs all of it, including the real-browser runs, on a clean machine.',
  'verified.fact1': 'A Chrome extension injects a runtime into the page’s MAIN world.',
  'verified.fact2': 'That runtime calls document.modelContext.registerTool().',
  'verified.fact3': 'A WebMCP agent outside the page discovers the tools, with their schemas.',
  'verified.fact4': 'The agent invokes them, and the site’s own form is filled in and submitted.',
  'verified.fact5': 'All three demo apps contain zero WebMCP code — asserted in CI.',
  'verified.runPhase0': 'Phase 0 criteria',
  'verified.runPhase0What': 'the core hypothesis, end to end',
  'verified.runFull': 'Full system',
  'verified.runFullWhat': 'three adapters, the portal, the confirmation gate',
  'verified.runRecorder': 'Recorder and Studio',
  'verified.runRecorderWhat': 'record a workflow, get a valid adapter',
  'verified.factUnitLabel':
    'unit and integration tests. The integration layer mounts the real demo apps and runs the real published adapters against them, so an adapter that drifts from the site it targets fails there.',
  'verified.factE2eLabel':
    'end-to-end tests in a real browser, plus three acceptance runs that drive Chrome over the DevTools protocol.',

  /* ------------------------------------------------------------ security -- */
  'security.headline': 'Auditable, origin-scoped and permission-aware.',
  'security.copy':
    'Not “safe”. The realistic worst case is a community adapter becoming browser malware, so the format is built so that is either impossible to express or visible before you install it.',
  'security.point1': 'No executable JavaScript anywhere in the format — the DSL cannot express it.',
  'security.point2': 'Exact origins only. A wildcard is rejected at validation, not warned about.',
  'security.point3': 'A hard refusal to touch password, card or other sensitive fields.',
  'security.point4': 'Values are never written to logs or traces.',
  'security.point5': 'Anything destructive asks you first, every time.',
  'security.limitTitle': 'The limitation we can’t engineer away.',
  'security.limitCopy':
    'WebMCP tools have to be registered in the page’s own JavaScript world, so the extension’s runtime lives there too. A hostile page can see it, call it, or patch it. It holds no extension privileges — the worst a page can do with it is drive its own DOM, which it could already do — but the isolation an extension normally gives you does not apply here, and you should weigh that.',
  'security.threatModel': 'Read the full threat model',

  /* --------------------------------------------------------------- close -- */
  'close.headline': 'Don’t wait for every website to adopt WebMCP.',
  'close.copy': 'The website never implemented WebMCP. Liha Adapter did.',
  'close.note':
    'Open source, MIT licensed — extension, runtime, DSL, registry, recorder, demo apps and tests.',

  /* --------------------------------------------------------------- store -- */
  'store.title': 'Adapters',
  'store.sub':
    'Each one is declarative JSON, scoped to exact origins, with every step and permission open to inspection before you install it.',
  'store.search': 'Search',
  'store.searchLabel': 'Search adapters',
  'store.category': 'Category',
  'store.capability': 'Capability',
  'store.allAdapters': 'All adapters',
  'store.anyCapability': 'Any capability',
  'store.featureKicker': 'Official collection',
  'store.featureHeadline': '{0} adapters, {1} tools, and not one line of JavaScript between them.',
  'store.featureCopy':
    'The step vocabulary has no {0} and no expression language, so a community adapter is something you can read rather than something you have to trust.',
  'store.shelfMatching': 'Matching adapters',
  'store.count': '{0} adapters',
  'store.countOne': '1 adapter',
  'store.toolCount': '{0} tools',
  'store.view': 'View',
  'store.open': 'Open',
  'store.noResults': 'No adapters match that search.',
  'store.demoShelf': 'Sites you can drive right now',
  'store.demoShelfLink': 'What you need first',
  'store.noOwnWebmcp': 'no WebMCP code of its own',
  'store.extShelf': 'The extension',
  'store.extBuild': 'Build from source',
  'store.extName': 'Liha WebMCP Adapter for Chrome',
  'store.extSub':
    'Validates an adapter, then registers its tools in the page. Chrome 151+ with the WebMCP flag on.',
  'store.extFirefox': 'Firefox build included',
  'store.get': 'Get',
  'store.installed': 'installed',

  /* -------------------------------------------------------------- detail -- */
  'detail.notFound': 'No adapter with that id.',
  'detail.back': 'Back to the registry',
  'detail.install': 'Install',
  'detail.reinstall': 'Reinstall',
  'detail.installing': 'Waiting for confirmation…',
  'detail.installedHere': 'Installed in this browser.',
  'detail.willShowPermissions': 'The extension will show you the permissions before installing.',
  'detail.installOk': 'Installed. Reload the target site to use the tools.',
  'detail.factTools': 'Tools',
  'detail.factCapability': 'Highest capability',
  'detail.factOrigins': 'Origins',
  'detail.factOriginsNote': 'exact, no wildcards',
  'detail.factVersion': 'Version',
  'detail.factVerified': 'Last verified',
  'detail.notVerified': 'not verified',
  'detail.healthInBrowser': '{0} in this browser',
  'detail.reachTitle': 'What it can reach',
  'detail.reachCopy':
    'This adapter runs only on these exact origins. It cannot run anywhere else, and it cannot navigate off them.',
  'detail.destructiveWarn': '{0} destructive tools ({1}). These always ask you before they run.',
  'detail.destructiveWarnOne': '1 destructive tool ({1}). These always ask you before they run.',
  'detail.toolsTitle': 'Tools',
  'detail.does': 'Does: {0} — {1} declarative steps',
  'detail.inputSchema': 'Input schema',
  'detail.sourceTitle': 'Source',
  'detail.sourceCopy':
    'Published at {0}. An adapter you cannot read is an adapter you should not install, so the whole definition is here — there is no hidden code, because the format cannot express any.',
  'detail.showSource': 'Show full definition',
  'detail.hideSource': 'Hide full definition',

  /* -------------------------------------------------------------- health -- */
  'health.healthy': 'healthy',
  'health.degraded': 'degraded',
  'health.broken': 'broken',
  'health.unknown': 'not checked',
  'health.title': 'Reported by your browser extension against the live site',

  /* -------------------------------------------- the guided build ---- */
  'nav.create': 'Build one',
  'create.eyebrow': 'Adapter Studio',
  'create.headline': 'Build a WebMCP tool for a site that has none.',
  'create.lede':
    'Record yourself using a website, shape what you did into a tool, install it, and call it from outside the page. Nothing here writes code, and the site is never touched. This page watches as you go — the steps it can check tick themselves.',
  'create.copy': 'Copy',
  'create.copied': 'Copied',
  'create.copyFailed': 'Copy failed',
  'create.done': 'done',
  'create.watching': 'watching',
  'create.step1': 'Turn WebMCP on',
  'create.step1Body':
    'Chrome keeps the API behind a flag. Paste this into the address bar, set it to Enabled, and relaunch — this step ticks itself once the API is there.',
  'create.copyFlag': 'Copy the flag URL',
  'create.step2': 'Install the extension',
  'create.step2Body':
    'Unzip it, open chrome://extensions, turn on Developer mode, and Load unpacked. This step ticks itself once the extension answers.',
  'create.getExtension': 'Download the extension',
  'create.step3': 'Open the site you want to teach',
  'create.step3Body':
    'Any site the extension can reach will do; the storefront below is one nobody has adapted yet. Open it in another tab and leave it open — the recorder listens to that tab, not this one.',
  'create.openDemo': 'Open {0}',
  'create.step4': 'Record what you would do by hand',
  'create.step4Body':
    'This happens in the other tab, so this page cannot watch it. Click the Liha icon there and:',
  'create.step4a': 'Press Record a tool.',
  'create.step4b': 'Do the thing — search for something, fill a form, whatever the tool should do.',
  'create.step4c': 'Press Stop recording. The Studio opens with what you did.',
  'create.step5': 'Shape it in the Studio',
  'create.step5Body': 'The recording is raw. Four things turn it into a tool worth giving an agent:',
  'create.step5a': 'Name it in snake_case, and describe it — that description is what an agent reads to decide when to use it.',
  'create.step5b': 'Turn the value you typed into an argument. It was an example, not a constant.',
  'create.step5c':
    'Add the step nobody clicked: reading the answer back is not an interaction, so the recorder never saw it. A readText or readList step is what makes the tool return something.',
  'create.step5d': 'Press Test selectors. A selector matching two elements is refused at runtime, so find out here.',
  'create.step6': 'Install it',
  'create.step6Body':
    'Press Install locally. The extension re-validates the definition and asks you to approve the exact origins and capabilities — asking is a request, and you decide. This page notices when it lands.',
  'create.step7': 'Call it',
  'create.step7Body': 'Go back to {0}, open the console, and run this. It is your tool, with your arguments.',
  'create.step7Waiting': 'Once your adapter is installed, the snippet that runs it appears here.',
  'create.copySnippet': 'Copy the snippet',
  'create.footnote':
    'The same definition is a file you can keep: Export JSON in the Studio publishes it, and Export native WebMCP writes the implementation the site’s own developers would ship — the version that makes the adapter unnecessary.',
} as const;

export type MessageKey = keyof typeof en;
