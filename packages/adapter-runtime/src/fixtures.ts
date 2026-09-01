import { validateAdapter, type AdapterDefinition } from '@liha/adapter-schema';

/**
 * Adapter fixtures for the runtime's own tests.
 *
 * Deliberately local rather than importing the published catalogue: the runtime
 * package must not depend on the adapters that happen to ship with it. The real
 * definitions are exercised against the real demo apps in tests/integration.
 */
function define(input: unknown): AdapterDefinition {
  const result = validateAdapter(input);
  if (!result.ok || !result.adapter) throw new Error(`fixture invalid: ${result.errors.join('; ')}`);
  return result.adapter;
}

export const CRM_FIXTURE = define({
  id: 'demo-crm',
  name: 'Demo CRM',
  version: '1.0.0',
  origins: ['http://localhost:5273'],
  tools: [
    {
      name: 'search_customers',
      description: 'Search the customer list and return the matching records.',
      capability: 'READ',
      inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      probeSelectors: ["[data-testid='customer-search']", "[data-testid='customer-list']"],
      steps: [
        { type: 'fill', selector: "[data-testid='customer-search']", value: '{{query}}' },
        { type: 'waitFor', selector: "[data-testid='customer-list']" },
        {
          type: 'readList',
          selector: "[data-testid='customer-list'] li",
          as: 'customers',
          fields: { name: { selector: "[data-field='name']" }, email: { selector: "[data-field='email']" } },
        },
      ],
    },
    {
      name: 'create_customer',
      description: 'Create a customer by filling in the real form.',
      capability: 'WRITE',
      inputSchema: {
        type: 'object',
        properties: { name: { type: 'string' }, email: { type: 'string' } },
        required: ['name', 'email'],
      },
      probeSelectors: ["[data-action='add-customer']"],
      steps: [
        { type: 'click', selector: "[data-action='add-customer']" },
        { type: 'waitFor', selector: "[data-testid='customer-form'] [name='name']" },
        { type: 'fill', selector: "[data-testid='customer-form'] [name='name']", value: '{{name}}' },
        { type: 'fill', selector: "[data-testid='customer-form'] [name='email']", value: '{{email}}' },
        { type: 'click', selector: "[data-action='create-customer']" },
        { type: 'waitFor', selector: "[data-testid='customer-dialog']", state: 'absent' },
        {
          type: 'readText',
          selector: "[data-testid='customer-list'] li:last-child [data-field='name']",
          as: 'created_customer',
        },
      ],
    },
    {
      name: 'update_customer',
      description: 'Rename a customer located by email address.',
      capability: 'WRITE',
      inputSchema: {
        type: 'object',
        properties: { email: { type: 'string' }, name: { type: 'string' } },
        required: ['email', 'name'],
      },
      probeSelectors: ["[data-testid='customer-search']"],
      steps: [
        { type: 'fill', selector: "[data-testid='customer-search']", value: '{{email}}' },
        { type: 'waitFor', selector: "[data-testid='customer-list'] li" },
        { type: 'click', selector: "[data-testid='customer-list'] li [data-action='edit-customer']" },
      ],
    },
  ],
});

export const PROJECT_FIXTURE = define({
  id: 'demo-project',
  name: 'Demo Project',
  version: '1.0.0',
  origins: ['http://localhost:5275'],
  tools: [
    {
      name: 'delete_task',
      description: 'Permanently delete a task located by title.',
      capability: 'DESTRUCTIVE',
      inputSchema: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] },
      probeSelectors: ["[data-testid='task-search']"],
      steps: [
        { type: 'fill', selector: "[data-testid='task-search']", value: '{{title}}' },
        { type: 'waitFor', selector: "[data-testid='task-list'] li" },
        { type: 'click', selector: "[data-testid='task-list'] li [data-action='delete-task']" },
        { type: 'waitFor', selector: "[data-testid='task-list'] li", state: 'absent' },
      ],
    },
  ],
});
