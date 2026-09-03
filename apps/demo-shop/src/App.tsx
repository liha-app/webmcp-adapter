import { useEffect, useMemo, useState } from "react";
import { ThemeControl } from "@liha/demo-ui/theme";
import type { CartLine, Coupon, Product } from "./types";

const PRODUCTS: Product[] = [
  { id: "p-100", name: "Aurora Desk Lamp", category: "lighting", price: 89 },
  {
    id: "p-101",
    name: "Nimbus Standing Desk",
    category: "furniture",
    price: 640,
  },
  { id: "p-102", name: "Cirrus Mesh Chair", category: "furniture", price: 410 },
  {
    id: "p-103",
    name: "Stratus Monitor Arm",
    category: "accessories",
    price: 135,
  },
  { id: "p-104", name: "Halo Ring Light", category: "lighting", price: 72 },
  { id: "p-105", name: "Vapor Cable Tray", category: "accessories", price: 38 },
];

const COUPONS: Coupon[] = [
  { code: "SAVE10", label: "10% off your order", discount: 0.1 },
  { code: "DESKWEEK", label: "15% off furniture week", discount: 0.15 },
];

/**
 * Deliberately no checkout, no payment step, and no stored payment details.
 * The demo stops at the cart.
 */
function usePath(): [string, (next: string) => void] {
  const [path, setPath] = useState(() => window.location.pathname);
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
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [couponStatus, setCouponStatus] = useState("");

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return PRODUCTS;
    return PRODUCTS.filter(
      (product) =>
        product.name.toLowerCase().includes(needle) ||
        product.category.toLowerCase().includes(needle),
    );
  }, [query]);

  const itemCount = lines.reduce((total, line) => total + line.quantity, 0);
  const subtotal = lines.reduce(
    (total, line) => total + line.product.price * line.quantity,
    0,
  );
  const total = coupon
    ? Math.round(subtotal * (1 - coupon.discount))
    : subtotal;

  function addToCart(product: Product) {
    setLines((prev) => {
      const existing = prev.find((line) => line.product.id === product.id);
      if (existing) {
        return prev.map((line) =>
          line.product.id === product.id
            ? { ...line, quantity: line.quantity + 1 }
            : line,
        );
      }
      return [...prev, { id: `line-${product.id}`, product, quantity: 1 }];
    });
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

  const onCart = path.startsWith("/cart");

  return (
    <>
      {/*
       * Apple's global bar: the store's name, and the two places you can be.
       * The cart count rides in the button, which is where a shopper looks.
       */}
      <header className="topbar">
        <div className="topbar__inner">
          <span className="topbar__brand">Nimbus Supply</span>
          <nav className="topbar__actions">
            <ThemeControl />
            <button
              type="button"
              className={`btn ${onCart ? "" : "btn--primary"}`}
              data-action="view-products"
              onClick={() => go("/")}
            >
              Products
            </button>
            <button
              type="button"
              className={`btn ${onCart ? "btn--primary" : ""}`}
              data-action="view-cart"
              onClick={() => go("/cart")}
            >
              Cart{" "}
              <span className="badge" data-testid="cart-count">
                {itemCount}
              </span>
            </button>
          </nav>
        </div>
      </header>

      <main className="app">
        {/*
         * Apple's buy page opens with a coloured eyebrow, a 48/55 semibold
         * title and a line of prices — then splits into a wide visual column
         * and a 328px column of options. That split is the page; a full-width
         * grid of cards is a different design wearing the same colours.
         */}
        <div className="pagehead">
          <p className="eyebrow">{onCart ? "Your bag" : "New"}</p>
          <h1>{onCart ? "Review your bag." : "Choose your Nimbus."}</h1>
          <p className="app__subtitle">
            An ordinary storefront. Nothing in here knows what an agent is.
          </p>
        </div>

        {!onCart && (
          <section className="buy" data-testid="products-panel">
            <div className="stage">
              <p className="stage__kicker">Nimbus Supply</p>
              <p className="stage__line">
                Six things for a desk that has to work. Search the catalogue, or
                read down the column.
              </p>
              <label className="stage__search">
                <span className="hidden-field">Search products</span>
                <input
                  className="search"
                  name="q"
                  placeholder="Search products"
                  aria-label="Search products"
                  data-testid="product-search"
                  autoComplete="off"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <p className="stage__count">
                <span className="badge" data-testid="product-result-count">
                  {results.length}
                </span>{" "}
                shown
              </p>
            </div>

            <div className="options">
              <h2 className="step">
                Products. <span>Pick what the desk is missing.</span>
              </h2>
              <ul className="list" data-testid="product-list">
                {results.map((product) => (
                  <li
                    key={product.id}
                    className="list__row"
                    data-product-id={product.id}
                  >
                    <span className="list__name" data-field="name">
                      {product.name}
                    </span>
                    <span className="list__muted" data-field="category">
                      {product.category}
                    </span>
                    <span className="list__muted" data-field="price">
                      ${product.price}
                    </span>
                    <button
                      type="button"
                      className="btn btn--small"
                      data-action="add-to-cart"
                      onClick={() => addToCart(product)}
                    >
                      Add to cart
                    </button>
                  </li>
                ))}
              </ul>
              {results.length === 0 && (
                <p className="empty" data-testid="product-empty">
                  Nothing matches that search.
                </p>
              )}
            </div>
          </section>
        )}

        {onCart && (
          <section className="buy" data-testid="cart-panel">
            <div className="stage stage--summary">
              <p className="stage__kicker">Order summary</p>
              <p className="stage__total" data-testid="cart-total">
                Total ${total}
              </p>
              <p className="stage__line list__muted">Subtotal ${subtotal}</p>
            </div>

            <div className="options">
              <h2 className="step">
                Your bag.{" "}
                <span>
                  {lines.length === 0
                    ? "Nothing in it yet."
                    : "Everything you picked."}
                </span>
              </h2>
              <p className="hidden-field" data-testid="cart-line-count">
                {lines.length}
              </p>
              <ul className="list" data-testid="cart-items">
                {lines.map((line) => (
                  <li
                    key={line.id}
                    className="list__row"
                    data-cart-item-id={line.id}
                  >
                    <span className="list__name" data-field="name">
                      {line.product.name}
                    </span>
                    <span className="list__muted" data-field="quantity">
                      {line.quantity}
                    </span>
                    <span className="list__muted" data-field="price">
                      ${line.product.price * line.quantity}
                    </span>
                  </li>
                ))}
              </ul>
              {lines.length === 0 && (
                <p className="empty" data-testid="cart-empty">
                  Your cart is empty.
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
            </div>
          </section>
        )}
      </main>
    </>
  );
}
