export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
}

export interface CartLine {
  id: string;
  product: Product;
  quantity: number;
}

export interface Coupon {
  code: string;
  label: string;
  discount: number;
}
