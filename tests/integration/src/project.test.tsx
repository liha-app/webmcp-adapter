import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '@liha/demo-project/app';
import { mountApp, rows, type Harness } from './harness';

let project: Harness;

beforeEach(async () => {
  window.history.replaceState({}, '', '/');
  project = await mountApp(App, 'demo-project');
});
afterEach(() => project.cleanup());

describe('demo-project adapter against the real app', () => {
  it('registers every declared tool', async () => {
    expect(await project.toolNames()).toEqual([
      'list_tasks',
      'create_task',
      'assign_task',
      'change_task_status',
      'flag_task',
      'unflag_task',
      'delete_task',
    ]);
  });

  it('create_task submits the real form and the app assigns the id', async () => {
    const result = await project.call('create_task', { title: 'Ship the adapter', assignee: 'Priya Nair' });
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent?.task_id).toMatch(/^t-\d+$/);
    expect(result.structuredContent?.assigned_to).toBe('Priya Nair');
    expect(document.body.textContent).toContain('Ship the adapter');
  });

  it('assign_task changes the assignee through the real select', async () => {
    const result = await project.call('assign_task', { title: 'Migrate billing', assignee: 'Priya Nair' });
    expect(result.isError).toBeUndefined();
    expect(rows('[data-testid="task-list"] li')[0]).toContain('Priya Nair');
  });

  it('change_task_status moves the task', async () => {
    const result = await project.call('change_task_status', { title: 'Draft launch', status: 'done' });
    expect(result.isError).toBeUndefined();
    expect(document.querySelector('[data-testid="task-list"] li')?.getAttribute('data-status')).toBe('done');
  });

  it('rejects a status the schema does not allow', async () => {
    const result = await project.call('change_task_status', { title: 'Draft launch', status: 'shipped' });
    expect(result.isError).toBe(true);
    expect(result.text).toContain('must be one of');
  });

  it('flag_task and unflag_task toggle the checkbox', async () => {
    await project.call('flag_task', { title: 'Migrate billing' });
    expect((document.querySelector('[data-task-id="t-202"] input[data-action="toggle-flag"]') as HTMLInputElement).checked).toBe(true);
    await project.call('unflag_task', { title: 'Migrate billing' });
    expect((document.querySelector('[data-task-id="t-202"] input[data-action="toggle-flag"]') as HTMLInputElement).checked).toBe(false);
  });

  it('list_tasks returns tasks with their assignee and status', async () => {
    const result = await project.call('list_tasks', { query: 'Audit' });
    expect(result.structuredContent?.tasks).toEqual([
      { id: 't-203', title: 'Audit vendor contracts', assignee: 'Unassigned', status: 'blocked' },
    ]);
  });

  describe('delete_task', () => {
    it('always asks the user first and deletes once approved', async () => {
      const result = await project.call('delete_task', { title: 'Audit vendor' });
      expect(project.confirmations).toEqual([{ toolName: 'delete_task', capability: 'DESTRUCTIVE' }]);
      expect(result.isError).toBeUndefined();
      expect(document.body.textContent).not.toContain('Audit vendor contracts');
    });

    it('changes nothing when the user declines', async () => {
      const guarded = await mountApp(App, 'demo-project', { approveConfirmations: false });
      try {
        const result = await guarded.call('delete_task', { title: 'Audit vendor' });
        expect(result.isError).toBe(true);
        expect(result.text).toContain('declined');
        expect(document.body.textContent).toContain('Audit vendor contracts');
      } finally {
        guarded.cleanup();
      }
    });

    it('refuses to delete when the title matches more than one task', async () => {
      const result = await project.call('delete_task', { title: 'a' });
      expect(result.isError).toBe(true);
      expect(rows('[data-testid="task-list"] li').length).toBeGreaterThan(1);
    });
  });
});
