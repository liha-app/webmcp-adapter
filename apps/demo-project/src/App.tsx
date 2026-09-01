import { useMemo, useState } from 'react';
import type { Task, TaskStatus } from './types';

const PEOPLE = ['Unassigned', 'Mika Tanaka', 'Jordan Reyes', 'Priya Nair'];
const STATUSES: Array<{ value: TaskStatus; label: string }> = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
];

const SEED: Task[] = [
  { id: 't-201', title: 'Draft launch checklist', assignee: 'Mika Tanaka', status: 'in_progress', flagged: false },
  { id: 't-202', title: 'Migrate billing records', assignee: 'Jordan Reyes', status: 'todo', flagged: false },
  { id: 't-203', title: 'Audit vendor contracts', assignee: 'Unassigned', status: 'blocked', flagged: true },
];

let nextId = 204;

export function App() {
  const [tasks, setTasks] = useState<Task[]>(SEED);
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState(PEOPLE[0] as string);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return tasks;
    return tasks.filter(
      (task) => task.title.toLowerCase().includes(needle) || task.assignee.toLowerCase().includes(needle),
    );
  }, [tasks, query]);

  function patch(id: string, changes: Partial<Task>) {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, ...changes } : task)));
  }

  function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError('A task needs a title.');
      return;
    }
    setTasks((prev) => [
      ...prev,
      { id: `t-${nextId++}`, title: trimmed, assignee, status: 'todo', flagged: false },
    ]);
    setTitle('');
    setAssignee(PEOPLE[0] as string);
    setError(null);
    setFormOpen(false);
  }

  return (
    <main className="app">
      <header className="app__header">
        <div>
          <h1>Kite Project Manager</h1>
          <p className="app__subtitle">Tasks, assignees, statuses. Nothing in here knows what an agent is.</p>
        </div>
        <button type="button" className="btn btn--primary" data-action="new-task" onClick={() => setFormOpen(true)}>
          New task
        </button>
      </header>

      {formOpen && (
        <section className="panel" data-testid="task-form-panel">
          <div className="panel__head">
            <h2>New task</h2>
          </div>
          <form className="taskform" data-testid="task-form" onSubmit={createTask}>
            <label className="field">
              <span>Title</span>
              <input name="title" autoComplete="off" value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="field">
              <span>Assignee</span>
              <select name="assignee" value={assignee} onChange={(event) => setAssignee(event.target.value)}>
                {PEOPLE.map((person) => (
                  <option key={person} value={person}>
                    {person}
                  </option>
                ))}
              </select>
            </label>
            {error && (
              <p className="error" data-testid="form-error">
                {error}
              </p>
            )}
            <div className="modal__actions">
              <button type="button" className="btn" data-action="cancel-task" onClick={() => setFormOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary" data-action="create-task">
                Create task
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="panel">
        <div className="panel__head">
          <h2>Tasks</h2>
          <span className="badge" data-testid="task-count">
            {visible.length}
          </span>
          <input
            className="search"
            name="q"
            placeholder="Search tasks"
            aria-label="Search tasks"
            data-testid="task-search"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <ul className="list" data-testid="task-list">
          {visible.map((task) => (
            <li key={task.id} className="list__row" data-task-id={task.id} data-status={task.status}>
              <span className="list__name" data-field="title">
                {task.title}
              </span>
              <span className="hidden-field" data-field="assignee">
                {task.assignee}
              </span>
              <span className="hidden-field" data-field="status">
                {task.status}
              </span>
              <select
                aria-label={`Assignee for ${task.title}`}
                data-action="assign"
                value={task.assignee}
                onChange={(event) => patch(task.id, { assignee: event.target.value })}
              >
                {PEOPLE.map((person) => (
                  <option key={person} value={person}>
                    {person}
                  </option>
                ))}
              </select>
              <select
                aria-label={`Status for ${task.title}`}
                data-action="status"
                value={task.status}
                onChange={(event) => patch(task.id, { status: event.target.value as TaskStatus })}
              >
                {STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
              <label className="flag">
                <input
                  type="checkbox"
                  data-action="toggle-flag"
                  aria-label={`Flag ${task.title}`}
                  checked={task.flagged}
                  onChange={(event) => patch(task.id, { flagged: event.target.checked })}
                />
                <span>Flag</span>
              </label>
              <button
                type="button"
                className="btn btn--small btn--danger"
                data-action="delete-task"
                onClick={() => setTasks((prev) => prev.filter((candidate) => candidate.id !== task.id))}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
        {visible.length === 0 && (
          <p className="empty" data-testid="task-empty">
            No tasks match that search.
          </p>
        )}
      </section>
    </main>
  );
}
