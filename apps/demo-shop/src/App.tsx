import { useEffect, useMemo, useState } from 'react';
import type { CartLine, Coupon, Product } from './types';

const PRODUCTS: Product[] = [
  { id: 'p-100', name: 'Aurora Desk Lamp', category: 'lighting', price: 89 },
  { id: 'p-101', name: 'Nimbus Standing Desk', category: 'furniture', price: 640 },
  { id: 'p-102', name: 'Cirrus Mesh Chair', category: 'furniture', price: 410 },
  { id: 'p-103', name: 'Stratus Monitor Arm', category: 'accessories', price: 135 },
  { id: 'p-104', name: 'Halo Ring Light', category: 'lighting', price: 72 },
  { id: 'p-105', name: 'Vapor Cable Tray', category: 'accessories', price: 38 },
];

const COUPONS: Coupon[] = [
  { code: 'SAVE10', label: '10% off your order', discount: 0.1 },
  { code: 'DESKWEEK', label: '15% off furniture week', discount: 0.15 },
];

/**
 * Deliberately no checkout, no payment step, and no stored payment details.
 * The demo stops at the cart.
 */
function usePath(): [string, (next: string) => void] {
  const [path, setPath] = useState(() => window.location.pathname);
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
  const [query, setQuery] = useState('');
  const [lines, setLines] = useState<CartLine[]>([]);
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [couponStatus, setCouponStatus] = useState('');

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return PRODUCTS;
    return PRODUCTS.filter(
      (product) =>
        product.name.toLowerCase().includes(needle) || product.category.toLowerCase().includes(needle),
    );
  }, [query]);

  const itemCount = lines.reduce((total, line) => total + line.quantity, 0);
  const subtotal = lines.reduce((total, line) => total + line.product.price * line.quantity, 0);
  const total = coupon ? Math.round(subtotal * (1 - coupon.discount)) : subtotal;

  function addToCart(product: Product) {
    setLines((prev) => {
      const existing = prev.find((line) => line.product.id === product.id);
      if (existing) {
        return prev.map((line) =>
          line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line,
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
      setCouponStatus(`Coupon ${code || '(empty)'} is not valid.`);
    }
  }

  const onCart = path.startsWith('/cart');

  return (
    <main className="app">
      <header className="app__header">
        <div>
          <h1>Nimbus Supply</h1>
          <p className="app__subtitle">An ordinary storefront. Nothing in here knows what an agent is.</p>
        </div>
        <nav className="nav">
          <button
            type="button"
            className={`btn ${onCart ? '' : 'btn--primary'}`}
            data-action="view-products"
            onClick={() => go('/')}
          >
            Products
          </button>
          <button
            type="button"
            className={`btn ${onCart ? 'btn--primary' : ''}`}
            data-action="view-cart"
            onClick={() => go('/cart')}
          >
            Cart <span className="badge" data-testid="cart-count">{itemCount}</span>
          </button>
        </nav>
      </header>

      {!onCart && (
        <section className="panel" data-testid="products-panel">
          <div className="panel__head">
            <h2>Products</h2>
            <span className="badge" data-testid="product-result-count">
              {results.length}
            </span>
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
          </div>
          <ul className="list" data-testid="product-list">
            {results.map((product) => (
              <li key={product.id} className="list__row" data-product-id={product.id}>
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
        </section>
      )}

      {onCart && (
        <section className="panel" data-testid="cart-panel">
          <div className="panel__head">
            <h2>Cart</h2>
            <span className="badge" data-testid="cart-line-count">
              {lines.length}
            </span>
          </div>
          <ul className="list" data-testid="cart-items">
            {lines.map((line) => (
              <li key={line.id} className="list__row" data-cart-item-id={line.id}>
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
            <div className="totals">
              <span className="list__muted">Subtotal ${subtotal}</span>
              <strong data-testid="cart-total">Total ${total}</strong>
            </div>
          </div>
          {couponStatus && (
            <p className="status" data-testid="coupon-status">
              {couponStatus}
            </p>
          )}
        </section>
      )}
    </main>
  );
}
