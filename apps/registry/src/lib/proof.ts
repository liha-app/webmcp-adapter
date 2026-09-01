/**
 * What has actually been verified, kept in one place so the claims on the
 * landing page cannot quietly drift from the suite that backs them.
 *
 * Update alongside the test suite — CONTRIBUTING points here.
 */
export const PROOF = {
  unitAndIntegrationTests: 200,
  e2eTests: 37,
  acceptance: [
    { name: 'Phase 0 criteria', result: '10/10', what: 'the core hypothesis, end to end' },
    { name: 'Full system', result: '43/43', what: 'three adapters, the portal, the confirmation gate' },
    { name: 'Recorder and Studio', result: '25/25', what: 'record a workflow, get a valid adapter' },
  ],
  facts: [
    'A Chrome extension injects a runtime into the page’s MAIN world.',
    'That runtime calls document.modelContext.registerTool().',
    'A WebMCP agent outside the page discovers the tools, with their schemas.',
    'The agent invokes them, and the site’s own form is filled in and submitted.',
    'All three demo apps contain zero WebMCP code — asserted in CI.',
  ],
  ciNote: 'Every push runs all of it, including the real-browser runs, on a clean machine.',
} as const;
