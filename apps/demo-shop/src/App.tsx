import { useEffect, useMemo, useState } from 'react';
import { ThemeControl } from '@liha/demo-ui/theme';
import type { BagLine, Coupon, Option, Step, StepId } from './types';

const BASE = 1999;

const STEPS: Step[] = [
  {
    id: 'chip',
    title: 'Chip.',
    lead: 'Start with the engine.',
    options: [
      { id: 'n3', label: 'Nimbus 3', blurb: '10-core CPU, 16-core GPU. Enough for most days.', extra: 0 },
      { id: 'n3-pro', label: 'Nimbus 3 Pro', blurb: '14-core CPU, 24-core GPU. For long renders.', extra: 600 },
      { id: 'n3-max', label: 'Nimbus 3 Max', blurb: '18-core CPU, 40-core GPU. For the heaviest work.', extra: 1400 },
    ],
  },
  {
    id: 'memory',
    title: 'Memory.',
    lead: 'How much you keep open at once.',
    options: [
      { id: '32gb', label: '32GB', blurb: 'Unified memory. The comfortable default.', extra: 0 },
      { id: '64gb', label: '64GB', blurb: 'For large projects and many of them.', extra: 400 },
      { id: '128gb', label: '128GB', blurb: 'For work that does not fit anywhere else.', extra: 1000 },
    ],
  },
  {
    id: 'storage',
    title: 'Storage.',
    lead: 'How much you keep.',
    options: [
      { id: '512gb', label: '512GB SSD', blurb: 'Fast, and enough to start.', extra: 0 },
      { id: '1tb', label: '1TB SSD', blurb: 'Room for a year of footage.', extra: 200 },
      { id: '2tb', label: '2TB SSD', blurb: 'Room for the archive too.', extra: 600 },
    ],
  },
];

const COUPONS: Coupon[] = [
  { code: 'NIMBUS10', label: '10% off', discount: 0.1 },
  { code: 'STUDIO25', label: '25% off', discount: 0.25 },
];

const stepOf = (id: StepId): Step => STEPS.find((step) => step.id === id) as Step;
const optionOf = (id: StepId, optionId: string): Option =>
  (stepOf(id).options.find((option) => option.id === optionId) ?? stepOf(id).options[0]) as Option;

/** Two routes, and the browser's own history — no router, on purpose. */
function usePath(): [string, (next: string) => void] {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return [
    path,
    (next: string) => {
      window.history.pushState({}, '', next);
      setPath(next);
    },
  ];
}

export function App() {
  const [path, go] = usePath();
  const [chosen, setChosen] = useState<Record<StepId, string>>({ chip: 'n3', memory: '32gb', storage: '512gb' });
  const [bag, setBag] = useState<BagLine[]>([]);
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [couponStatus, setCouponStatus] = useState('');
  /* The bag page has three states, and the last one is a receipt. Nothing in
   * any of them asks for a card: the demo stops where a real store would start
   * collecting payment, which is the line this project does not cross. */
  const [stage, setStage] = useState<'bag' | 'review'>('bag');

  const picked = useMemo(
    () => ({
      chip: optionOf('chip', chosen.chip),
      memory: optionOf('memory', chosen.memory),
      storage: optionOf('storage', chosen.storage),
    }),
    [chosen],
  );
  const configured = BASE + picked.chip.extra + picked.memory.extra + picked.storage.extra;
  const subtotal = bag.reduce((total, line) => total + line.price, 0);
  const total = coupon ? Math.round(subtotal * (1 - coupon.discount)) : subtotal;
  const onBag = path.startsWith('/bag');

  function choose(step: StepId, optionId: string) {
    setChosen((prev) => ({ ...prev, [step]: optionId }));
  }

  function addToBag() {
    setBag((prev) => [
      ...prev,
      { id: `line-${prev.length + 1}`, chip: picked.chip, memory: picked.memory, storage: picked.storage, price: configured },
    ]);
    setStage('bag');
    go('/bag');
  }

  function applyCoupon(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = couponInput.trim().toUpperCase();
    const found = COUPONS.find((candidate) => candidate.code === code);
    if (found) {
      setCoupon(found);
      setCouponStatus(`Coupon ${found.code} applied — ${found.label}.`);
    } else {
      setCoupon(null);
      setCouponStatus(`Coupon ${code || '(empty)'} is not valid.`);
    }
  }


  return (
    <>
      <header className="topbar">
        <div className="topbar__inner">
          <span className="topbar__brand">Nimbus Supply</span>
          <nav className="topbar__actions">
            <ThemeControl />
            <button
              type="button"
              className={`btn ${onBag ? '' : 'btn--primary'}`}
              data-action="view-configure"
              onClick={() => go('/')}
            >
              Configure
            </button>
            <button type="button" className={`btn ${onBag ? 'btn--primary' : ''}`} data-action="view-bag" onClick={() => go('/bag')}>
              Bag <span className="badge" data-testid="bag-count">{bag.length}</span>
            </button>
          </nav>
        </div>
      </header>

      <main className="app">
        <div className="pagehead">
          <p className="eyebrow">{onBag ? 'Your bag' : 'New'}</p>
          <h1>{onBag ? 'Review your bag.' : 'Build your Nimbus Studio.'}</h1>
          <p className="app__subtitle">An ordinary storefront. Nothing in here knows what an agent is.</p>
        </div>

        {!onBag && (
          <section className="buy" data-testid="configure-panel">
            <div className="left">
              {/*
                * The gallery, which is most of what a buy page is: the thing
                * you are configuring, large, on its own ground. Two renders
                * rather than one, because the product is photographed against
                * the page and the page has two.
                */}
              <figure className="gallery">
                <img
                  className="gallery__light"
                  src="/product/studio-light.webp"
                  width={1100}
                  height={825}
                  alt="The Nimbus Studio: a compact aluminium desktop computer, seen from above and to one side."
                />
                <img
                  className="gallery__dark"
                  src="/product/studio-dark.webp"
                  width={1100}
                  height={825}
                  alt=""
                  aria-hidden="true"
                />
                <figcaption>
                  Nimbus Studio · <span data-field="configured-chip">{picked.chip.label}</span>
                </figcaption>
              </figure>

            {/* The stage: what you have built so far, and what it costs. */}
            <aside className="stage" data-testid="config-summary">
              <p className="stage__kicker">Your configuration</p>
              <p className="stage__total" data-testid="config-total">
                ${configured}
              </p>
              <dl className="spec">
                {STEPS.map((step) => (
                  <div className="spec__row" key={step.id}>
                    <dt>{step.title.replace('.', '')}</dt>
                    <dd>
                      <select
                        data-testid={`config-${step.id}`}
                        aria-label={`${step.title.replace('.', '')} choice`}
                        value={chosen[step.id]}
                        onChange={(event) => choose(step.id, event.target.value)}
                      >
                        {step.options.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </dd>
                  </div>
                ))}
              </dl>
              <button type="button" className="btn btn--primary btn--wide" data-action="add-to-bag" onClick={addToBag}>
                Add to bag
              </button>
            </aside>
            </div>

            <div className="options">
              {STEPS.map((step) => (
                <section className="step" data-step={step.id} key={step.id}>
                  <h2 className="step__head">
                    {step.title} <span>{step.lead}</span>
                  </h2>
                  <ul className="list" data-testid="option-list">
                    {step.options.map((option) => {
                      const selected = chosen[step.id] === option.id;
                      return (
                        <li
                          key={option.id}
                          className={`list__row ${selected ? 'list__row--on' : ''}`}
                          data-option-id={option.id}
                          data-selected={selected ? 'true' : 'false'}
                        >
                          <span className="list__name" data-field="name">
                            {option.label}
                          </span>
                          <span className="list__blurb" data-field="blurb">
                            {option.blurb}
                          </span>
                          <span className="list__price" data-field="price">
                            {option.extra === 0 ? 'Included' : `+$${option.extra}`}
                          </span>
                          <button
                            type="button"
                            className="btn btn--small"
                            data-action="select-option"
                            aria-pressed={selected}
                            onClick={() => choose(step.id, option.id)}
                          >
                            {selected ? 'Selected' : 'Select'}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </section>
        )}

        {onBag && (
          <section className="buy" data-testid="bag-panel">
            <aside className="stage stage--summary">
              <p className="stage__kicker">Order summary</p>
              <p className="stage__total" data-testid="bag-total">
                Total ${total}
              </p>
              <p className="stage__line list__muted">Subtotal ${subtotal}</p>
              {stage === 'bag' && bag.length > 0 && (
                <button type="button" className="btn btn--primary btn--wide" data-action="review-order" onClick={() => setStage('review')}>
                  Review order
                </button>
              )}
            </aside>

            <div className="options">
              <h2 className="step__head">
                Your bag. <span>{bag.length === 0 ? 'Nothing in it yet.' : 'Everything you built.'}</span>
              </h2>
              <ul className="list" data-testid="bag-items">
                {bag.map((line) => (
                  <li key={line.id} className="list__row list__row--withthumb" data-bag-item-id={line.id}>
                    <img className="thumb thumb--light" src="/product/studio-thumb.webp" width={180} height={180} alt="" aria-hidden="true" />
                    <img className="thumb thumb--dark" src="/product/studio-thumb-dark.webp" width={180} height={180} alt="" aria-hidden="true" />
                    <span className="list__name" data-field="name">
                      Nimbus Studio
                    </span>
                    <span className="list__blurb" data-field="spec">
                      {line.chip.label} · {line.memory.label} · {line.storage.label}
                    </span>
                    <span className="list__price" data-field="price">
                      ${line.price}
                    </span>
                  </li>
                ))}
              </ul>
              {bag.length === 0 && (
                <p className="empty" data-testid="bag-empty">
                  Your bag is empty.
                </p>
              )}

              <div className="cart__footer">
                <form className="coupon" data-testid="coupon-form" onSubmit={applyCoupon}>
                  <input
                    name="coupon"
                    placeholder="Coupon code"
                    aria-label="Coupon code"
                    autoComplete="off"
                    value={couponInput}
                    onChange={(event) => setCouponInput(event.target.value)}
                  />
                  <button type="submit" className="btn" data-action="apply-coupon">
                    Apply
                  </button>
                </form>
              </div>
              {couponStatus && (
                <p className="status" data-testid="coupon-status">
                  {couponStatus}
                </p>
              )}

              {stage === 'review' && (
                <section className="review" data-testid="order-review">
                  <h2 className="step__head">
                    Review order. <span>Confirm what you are ordering.</span>
                  </h2>
                  {/*
                    * A review, and then a receipt. No card, no address, no
                    * account — the demo stops exactly where a real store would
                    * begin collecting them, and the runtime refuses those
                    * fields anyway.
                    */}
                  <p className="review__line">
                    {bag.length} item(s) · <strong data-testid="review-total">${total}</strong>
                  </p>
                  <p className="review__note">
                    This is where a real store would ask for payment. This one never does, and never will —
                    the runtime refuses card and password fields outright.
                  </p>
                </section>
              )}

            </div>
          </section>
        )}
      </main>
    </>
  );
}
