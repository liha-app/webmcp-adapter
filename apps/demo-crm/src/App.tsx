import { useMemo, useState } from 'react';
import type { Customer } from './types';

const SEED: Customer[] = [
  { id: 'c-1001', name: 'Mika Tanaka', email: 'mika@northwind.test', createdAt: '2026-06-02' },
  { id: 'c-1002', name: 'Jordan Reyes', email: 'jordan@globex.test', createdAt: '2026-06-11' },
  { id: 'c-1003', name: 'Priya Nair', email: 'priya@initech.test', createdAt: '2026-07-04' },
];

let nextId = 1004;

type Dialog = { mode: 'create' } | { mode: 'edit'; customer: Customer } | null;

export function App() {
  const [customers, setCustomers] = useState<Customer[]>(SEED);
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(needle) || customer.email.toLowerCase().includes(needle),
    );
  }, [customers, query]);

  function openCreate() {
    setName('');
    setEmail('');
    setError(null);
    setDialog({ mode: 'create' });
  }

  function openEdit(customer: Customer) {
    setName(customer.name);
    setEmail(customer.email);
    setError(null);
    setDialog({ mode: 'edit', customer });
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail) {
      setError('Name and email are both required.');
      return;
    }
    if (!trimmedEmail.includes('@')) {
      setError('Email looks invalid.');
      return;
    }
    if (dialog?.mode === 'edit') {
      const target = dialog.customer;
      setCustomers((prev) =>
        prev.map((customer) =>
          customer.id === target.id ? { ...customer, name: trimmedName, email: trimmedEmail } : customer,
        ),
      );
    } else {
      setCustomers((prev) => [
        ...prev,
        {
          id: `c-${nextId++}`,
          name: trimmedName,
          email: trimmedEmail,
          createdAt: new Date().toISOString().slice(0, 10),
        },
      ]);
    }
    setDialog(null);
  }

  return (
    <>
      {/*
        * Apple's global bar: the site's name on the left, the thing you came to
        * do on the right, and it stays put — an action you reach for should not
        * be something you scroll back to.
        */}
      <header className="topbar">
        <div className="topbar__inner">
          <span className="topbar__brand">Acme CRM</span>
          <div className="topbar__actions">
            <button type="button" className="btn btn--primary" data-action="add-customer" onClick={openCreate}>
              Add customer
            </button>
          </div>
        </div>
      </header>

      <main className="app">
        <div className="pagehead">
          <h1>Customers</h1>
          <p className="app__subtitle">A perfectly ordinary web app. It knows nothing about agents.</p>
        </div>

        <section className="panel">
          <div className="panel__head">
            <h2>All customers</h2>
            <span className="badge" data-testid="customer-count">
              {visible.length}
            </span>
            <input
              className="search"
              name="q"
              placeholder="Search customers"
              aria-label="Search customers"
              data-testid="customer-search"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <ul className="list" data-testid="customer-list">
            {visible.map((customer) => (
              <li key={customer.id} className="list__row" data-customer-id={customer.id}>
                <span className="list__name" data-field="name">
                  {customer.name}
                </span>
                <span className="list__email" data-field="email">
                  {customer.email}
                </span>
                <span className="list__date" data-field="created-at">
                  {customer.createdAt}
                </span>
                <button
                  type="button"
                  className="btn btn--small"
                  data-action="edit-customer"
                  onClick={() => openEdit(customer)}
                >
                  Edit
                </button>
              </li>
            ))}
          </ul>
          {visible.length === 0 && (
            <p className="empty" data-testid="customer-empty">
              No customers match that search.
            </p>
          )}
        </section>

        {dialog && (
          <div className="overlay" role="presentation">
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-label={dialog.mode === 'edit' ? 'Edit customer' : 'Add customer'}
              data-testid={dialog.mode === 'edit' ? 'customer-edit-dialog' : 'customer-dialog'}
            >
              <h2>{dialog.mode === 'edit' ? 'Edit customer' : 'Add customer'}</h2>
              <form data-testid={dialog.mode === 'edit' ? 'customer-edit-form' : 'customer-form'} onSubmit={submit}>
                <label className="field">
                  <span>Name</span>
                  <input name="name" autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} />
                </label>
                <label className="field">
                  <span>Email</span>
                  <input
                    name="email"
                    type="email"
                    autoComplete="off"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>
                {error && (
                  <p className="error" data-testid="form-error">
                    {error}
                  </p>
                )}
                <div className="modal__actions">
                  <button type="button" className="btn" data-action="cancel-customer" onClick={() => setDialog(null)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn--primary"
                    data-action={dialog.mode === 'edit' ? 'save-customer' : 'create-customer'}
                  >
                    {dialog.mode === 'edit' ? 'Save' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
