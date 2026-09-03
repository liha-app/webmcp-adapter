import { useEffect, useMemo, useState } from "react";
import { ThemeControl } from "@liha/demo-ui/theme";
import type { BagLine, Coupon, Option, Shot, Step, StepId } from "./types";

const BASE = 899;

/** Four views of the one desk, the way a buy page shows a product. */
const SHOTS: Shot[] = [
  {
    src: "/product/desk-1.webp",
    alt: "The Nimbus Desk seen from the front left: an oak top on a slim black steel frame.",
    caption: "Three-quarter view",
  },
  {
    src: "/product/desk-2.webp",
    alt: "The Nimbus Desk straight on, showing the frame and its cross-brace.",
    caption: "Front",
  },
  {
    src: "/product/desk-3.webp",
    alt: "A close view of one corner, where the eased oak edge meets the black steel leg.",
    caption: "Edge and leg",
  },
  {
    src: "/product/desk-4.webp",
    alt: "The Nimbus Desk in use, with a closed laptop and a ceramic cup on the top.",
    caption: "In use",
  },
];

const STEPS: Step[] = [
  {
    id: "top",
    title: "Top.",
    lead: "The part you touch.",
    options: [
      {
        id: "oak",
        label: "Solid oak",
        blurb: "Warm, open grain, eased edge. Ages well.",
        extra: 0,
      },
      {
        id: "walnut",
        label: "Solid walnut",
        blurb: "Darker, tighter grain. The same edge.",
        extra: 260,
      },
      {
        id: "charcoal",
        label: "Charcoal laminate",
        blurb: "Matte, fingerprint-resistant, hard-wearing.",
        extra: -80,
      },
    ],
  },
  {
    id: "size",
    title: "Size.",
    lead: "How much room you need.",
    options: [
      {
        id: "120",
        label: "120 × 70 cm",
        blurb: "A laptop, a lamp, a notebook.",
        extra: 0,
      },
      {
        id: "140",
        label: "140 × 70 cm",
        blurb: "A monitor and somewhere to write.",
        extra: 120,
      },
      {
        id: "180",
        label: "180 × 80 cm",
        blurb: "Two monitors, or one and a lot of paper.",
        extra: 320,
      },
    ],
  },
  {
    id: "base",
    title: "Base.",
    lead: "How it stands.",
    options: [
      {
        id: "fixed",
        label: "Fixed frame",
        blurb: "Powder-coated steel, 73cm, cross-braced.",
        extra: 0,
      },
      {
        id: "adjustable",
        label: "Height-adjustable",
        blurb: "Electric, 68–118cm, one motor per leg.",
        extra: 420,
      },
      {
        id: "memory",
        label: "Adjustable + memory",
        blurb: "The same, with four saved heights.",
        extra: 560,
      },
    ],
  },
];

const COUPONS: Coupon[] = [
  { code: "NIMBUS10", label: "10% off", discount: 0.1 },
  { code: "STUDIO25", label: "25% off", discount: 0.25 },
];

const stepOf = (id: StepId): Step =>
  STEPS.find((step) => step.id === id) as Step;
const optionOf = (id: StepId, optionId: string): Option =>
  (stepOf(id).options.find((option) => option.id === optionId) ??
    stepOf(id).options[0]) as Option;

/** Two routes, and the browser's own history — no router, on purpose. */
function usePath(): [string, (next: string) => void] {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return [
    path,
    (next: string) => {
      window.history.pushState({}, "", next);
      setPath(next);
      // A route change is a new page, so it starts at the top of it.
      window.scrollTo(0, 0);
    },
  ];
}

export function App() {
  const [path, go] = usePath();
  const [chosen, setChosen] = useState<Record<StepId, string>>({
    top: "oak",
    size: "120",
    base: "fixed",
  });
  const [shot, setShot] = useState(0);
  const [bag, setBag] = useState<BagLine[]>([]);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [couponStatus, setCouponStatus] = useState("");
  /* The bag has two states, and the second is a review. Nothing in either asks
   * for a card: the store stops where a real one would start collecting
   * payment, which is the line this project does not cross. */
  const [stage, setStage] = useState<"bag" | "review">("bag");

  /*
   * Apple's buy page grows a fixed bar carrying the product and its running
   * price once you scroll past the hero — the price has to stay reachable while
   * you are half a screen down a column of options.
   */
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 220);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const picked = useMemo(
    () => ({
      top: optionOf("top", chosen.top),
      size: optionOf("size", chosen.size),
      base: optionOf("base", chosen.base),
    }),
    [chosen],
  );
  const configured =
    BASE + picked.top.extra + picked.size.extra + picked.base.extra;
  const subtotal = bag.reduce(
    (running, line) => running + line.price * line.quantity,
    0,
  );
  const total = coupon
    ? Math.round(subtotal * (1 - coupon.discount))
    : subtotal;
  const onBag = path.startsWith("/bag");
  const current = SHOTS[shot] as Shot;

  function choose(step: StepId, optionId: string) {
    setChosen((prev) => ({ ...prev, [step]: optionId }));
  }

  function addToBag() {
    setBag((prev) => [
      ...prev,
      {
        id: `line-${prev.length + 1}`,
        top: picked.top,
        size: picked.size,
        base: picked.base,
        price: configured,
        quantity: 1,
      },
    ]);
    setStage("bag");
    go("/bag");
  }

  function setQuantity(id: string, quantity: number) {
    setBag((prev) =>
      prev.map((line) => (line.id === id ? { ...line, quantity } : line)),
    );
  }

  function removeLine(id: string) {
    setBag((prev) => prev.filter((line) => line.id !== id));
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
      setCouponStatus(`Coupon ${code || "(empty)"} is not valid.`);
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
              className={`btn ${onBag ? "" : "btn--primary"}`}
              data-action="view-configure"
              onClick={() => go("/")}
            >
              Configure
            </button>
            <button
              type="button"
              className={`btn ${onBag ? "btn--primary" : ""}`}
              data-action="view-bag"
              onClick={() => go("/bag")}
            >
              Bag{" "}
              <span className="badge" data-testid="bag-count">
                {bag.length}
              </span>
            </button>
          </nav>
        </div>
      </header>

      {!onBag && (
        <div
          className={`pricebar ${scrolled ? "pricebar--on" : ""}`}
          aria-hidden={!scrolled}
        >
          <div className="pricebar__inner">
            <span className="pricebar__name">Nimbus Desk</span>
            <span className="pricebar__price">${configured}</span>
          </div>
        </div>
      )}

      <main className="app">
        {/* The bag carries its own header, at the bag page's own scale. */}
        {!onBag && (
          <div className="pagehead">
            <p className="eyebrow">New</p>
            <h1>Build your Nimbus Desk.</h1>
            <p className="app__subtitle">
              An ordinary storefront. Nothing in here knows what an agent is.
            </p>
          </div>
        )}

        {!onBag && (
          <section className="buy" data-testid="configure-panel">
            {/*
             * The gallery sticks while the options scroll past it, which is
             * how the buy page is built: a wide sticky column on the left, a
             * tall static one on the right.
             */}
            <div className="gallerycol">
              <figure className="gallery" data-testid="gallery">
                <div className="gallery__frame">
                  <img
                    key={current.src}
                    className="gallery__image"
                    src={current.src}
                    width={1000}
                    height={681}
                    alt={current.alt}
                    data-testid="gallery-image"
                  />
                  <button
                    type="button"
                    className="gallery__arrow gallery__arrow--prev"
                    data-action="gallery-prev"
                    aria-label="Previous image"
                    onClick={() =>
                      setShot(
                        (index) => (index - 1 + SHOTS.length) % SHOTS.length,
                      )
                    }
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="gallery__arrow gallery__arrow--next"
                    data-action="gallery-next"
                    aria-label="Next image"
                    onClick={() =>
                      setShot((index) => (index + 1) % SHOTS.length)
                    }
                  >
                    ›
                  </button>
                </div>
                <div
                  className="gallery__dots"
                  role="tablist"
                  aria-label="Product images"
                >
                  {SHOTS.map((candidate, index) => (
                    <button
                      key={candidate.src}
                      type="button"
                      role="tab"
                      className="gallery__dot"
                      data-action="gallery-select"
                      aria-selected={index === shot}
                      aria-label={candidate.caption}
                      onClick={() => setShot(index)}
                    />
                  ))}
                </div>
                <figcaption>
                  <span data-testid="gallery-caption">{current.caption}</span> ·
                  Nimbus Desk in{" "}
                  <span data-field="configured-top">{picked.top.label}</span>
                </figcaption>
              </figure>
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
                          className={`list__row ${selected ? "list__row--on" : ""}`}
                          data-option-id={option.id}
                          data-selected={selected ? "true" : "false"}
                        >
                          <span className="list__name" data-field="name">
                            {option.label}
                          </span>
                          <span className="list__blurb" data-field="blurb">
                            {option.blurb}
                          </span>
                          <span className="list__price" data-field="price">
                            {option.extra === 0
                              ? "Included"
                              : option.extra > 0
                                ? `+$${option.extra}`
                                : `−$${Math.abs(option.extra)}`}
                          </span>
                          <button
                            type="button"
                            className="btn btn--small"
                            data-action="select-option"
                            aria-pressed={selected}
                            onClick={() => choose(step.id, option.id)}
                          >
                            {selected ? "Selected" : "Select"}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}

              {/* The summary is the last block in the column, not a panel. */}
              <aside className="summary" data-testid="config-summary">
                <h2 className="step__head">
                  Your Nimbus Desk. <span>Check it over.</span>
                </h2>
                <p className="summary__price" data-testid="config-total">
                  ${configured}
                </p>
                <dl className="spec">
                  {STEPS.map((step) => (
                    <div className="spec__row" key={step.id}>
                      <dt>{step.title.replace(".", "")}</dt>
                      <dd>
                        <select
                          data-testid={`config-${step.id}`}
                          aria-label={`${step.title.replace(".", "")} choice`}
                          value={chosen[step.id]}
                          onChange={(event) =>
                            choose(step.id, event.target.value)
                          }
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
                <button
                  type="button"
                  className="btn btn--primary btn--wide"
                  data-action="add-to-bag"
                  onClick={addToBag}
                >
                  Add to bag
                </button>
              </aside>
            </div>
          </section>
        )}

        {onBag && (
          /*
           * Apple's bag page, measured off rs-checkout's own stylesheet: a
           * 980px row, the product photo in the first three columns and
           * everything else in the last nine, item titles and prices at 24/28
           * w600, a summary whose total sits above a 1px #d2d2d7 rule, and a
           * 360px action button floated to the end of the column.
           */
          <section className="bag" data-testid="bag-panel">
            <header className="bag__head">
              <h1 className="bag__title">Review your bag.</h1>
              <p className="bag__lede">Everything in here ships free.</p>
            </header>

            {/* Apple runs a financing promo in this slot. This store has
             * nothing to finance, and says the more useful thing instead. */}
            <p className="notice">
              Nothing on this page can take a payment — the review is where it
              stops.
            </p>

            <ul className="items" data-testid="bag-items">
              {bag.map((line) => (
                <li className="item" key={line.id} data-bag-item-id={line.id}>
                  <div className="item__shot">
                    {/* The same render as the gallery's first shot, which
                      * the browser already has. */}
                    <img
                      src="/product/desk-1.webp"
                      width={1000}
                      height={681}
                      alt=""
                      aria-hidden="true"
                    />
                  </div>
                  <div className="item__body">
                    <div className="item__head">
                      <h2 className="item__title" data-field="name">
                        Nimbus Desk
                      </h2>
                      <div className="item__qty">
                        <label
                          className="hidden-field"
                          htmlFor={`qty-${line.id}`}
                        >
                          Quantity
                        </label>
                        <select
                          id={`qty-${line.id}`}
                          data-testid="item-quantity"
                          value={line.quantity}
                          onChange={(event) =>
                            setQuantity(line.id, Number(event.target.value))
                          }
                        >
                          {[1, 2, 3].map((count) => (
                            <option key={count} value={count}>
                              {count}
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className="item__price" data-field="price">
                        ${line.price * line.quantity}
                      </p>
                    </div>
                    <p className="item__spec" data-field="spec">
                      {line.top.label} · {line.size.label} · {line.base.label}
                    </p>
                    <button
                      type="button"
                      className="link item__remove"
                      data-action="remove-item"
                      onClick={() => removeLine(line.id)}
                    >
                      Remove
                    </button>
                    <div className="item__ways">
                      <p>
                        <svg viewBox="0 0 22 22" aria-hidden="true">
                          <path d="M1.75 5.25h10v9.5h-10z" />
                          <path d="M11.75 8.25h3.6l2.9 3v3.5h-6.5z" />
                          <circle cx="5.5" cy="16.5" r="1.6" />
                          <circle cx="15" cy="16.5" r="1.6" />
                        </svg>
                        <span>
                          <strong>Delivered in 2–3 weeks.</strong>
                          <br />
                          Free shipping, and 14 days to change your mind.
                        </span>
                      </p>
                      <p>
                        <svg viewBox="0 0 22 22" aria-hidden="true">
                          <path d="M3.25 8.75V18.25h15.5V8.75" />
                          <path d="M2.25 8.75 4 4.25h14l1.75 4.5a2.6 2.6 0 0 1-5 0 2.6 2.6 0 0 1-5 0 2.6 2.6 0 0 1-5 0Z" />
                        </svg>
                        <span>
                          <strong>Collect at the workshop.</strong>
                          <br />
                          Wednesdays and Fridays, by appointment.
                        </span>
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {bag.length === 0 && (
              <p className="empty" data-testid="bag-empty">
                Your bag is empty.
              </p>
            )}

            <div className="summary2">
              <form
                className="coupon"
                data-testid="coupon-form"
                onSubmit={applyCoupon}
              >
                <input
                  name="coupon"
                  placeholder="Coupon code"
                  aria-label="Coupon code"
                  autoComplete="off"
                  value={couponInput}
                  onChange={(event) => setCouponInput(event.target.value)}
                />
                <button
                  type="submit"
                  className="btn"
                  data-action="apply-coupon"
                >
                  Apply
                </button>
              </form>
              {couponStatus && (
                <p className="status" data-testid="coupon-status">
                  {couponStatus}
                </p>
              )}

              <dl className="sums">
                <div className="sums__row">
                  <dt>Subtotal</dt>
                  <dd>${subtotal}</dd>
                </div>
                <div className="sums__row">
                  <dt>Shipping</dt>
                  <dd>Free</dd>
                </div>
                {coupon && (
                  <div className="sums__row sums__row--off">
                    <dt>Coupon {coupon.code}</dt>
                    <dd>−${subtotal - total}</dd>
                  </div>
                )}
              </dl>
              <p className="sums__total" data-testid="bag-total">
                <span>Total</span>
                <span>${total}</span>
              </p>
              <p className="sums__note">
                Nothing is charged. This store has no payment step, and the
                runtime it is driven by refuses card and password fields
                outright.
              </p>

              <div className="actions">
                <button
                  type="button"
                  className="btn btn--out btn--wide"
                  onClick={() => go("/")}
                >
                  Keep configuring
                </button>
                {bag.length > 0 && (
                  <button
                    type="button"
                    className="btn btn--primary btn--wide"
                    data-action="review-order"
                    onClick={() => setStage("review")}
                  >
                    Review order
                  </button>
                )}
              </div>

              {stage === "review" && (
                <section className="review" data-testid="order-review">
                  <h2 className="review__head">Review order.</h2>
                  <p className="review__line">
                    {bag.length} item(s) ·{" "}
                    <strong data-testid="review-total">${total}</strong>
                  </p>
                  <p className="review__note">
                    This is where a real store would ask for payment. This one
                    never does, and never will.
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
