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
  const subtotal = bag.reduce((total, line) => total + line.price, 0);
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
      },
    ]);
    setStage("bag");
    go("/bag");
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
        <div className="pagehead">
          <p className="eyebrow">{onBag ? "Your bag" : "New"}</p>
          <h1>{onBag ? "Review your bag." : "Build your Nimbus Desk."}</h1>
          <p className="app__subtitle">
            An ordinary storefront. Nothing in here knows what an agent is.
          </p>
        </div>

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
          <section className="buy" data-testid="bag-panel">
            <div className="options">
              <h2 className="step__head">
                Your bag.{" "}
                <span>
                  {bag.length === 0
                    ? "Nothing in it yet."
                    : "Everything you built."}
                </span>
              </h2>
              <ul className="list" data-testid="bag-items">
                {bag.map((line) => (
                  <li
                    key={line.id}
                    className="list__row list__row--withthumb"
                    data-bag-item-id={line.id}
                  >
                    <img
                      className="thumb"
                      src="/product/desk-thumb.webp"
                      width={200}
                      height={136}
                      alt=""
                      aria-hidden="true"
                    />
                    <span className="list__name" data-field="name">
                      Nimbus Desk
                    </span>
                    <span className="list__blurb" data-field="spec">
                      {line.top.label} · {line.size.label} · {line.base.label}
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
              </div>
              {couponStatus && (
                <p className="status" data-testid="coupon-status">
                  {couponStatus}
                </p>
              )}

              {stage === "review" && (
                <section className="review" data-testid="order-review">
                  <h2 className="step__head">
                    Review order. <span>Confirm what you are ordering.</span>
                  </h2>
                  <p className="review__line">
                    {bag.length} item(s) ·{" "}
                    <strong data-testid="review-total">${total}</strong>
                  </p>
                  <p className="review__note">
                    This is where a real store would ask for payment. This one
                    never does, and never will — the runtime refuses card and
                    password fields outright.
                  </p>
                </section>
              )}
            </div>

            <aside className="stage stage--summary">
              <p className="stage__kicker">Order summary</p>
              <p className="stage__total" data-testid="bag-total">
                Total ${total}
              </p>
              <p className="stage__line list__muted">Subtotal ${subtotal}</p>
              {stage === "bag" && bag.length > 0 && (
                <button
                  type="button"
                  className="btn btn--primary btn--wide"
                  data-action="review-order"
                  onClick={() => setStage("review")}
                >
                  Review order
                </button>
              )}
            </aside>
          </section>
        )}
      </main>
    </>
  );
}
