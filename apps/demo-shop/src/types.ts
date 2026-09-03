export type StepId = 'top' | 'size' | 'base';

export interface Option {
  id: string;
  /** What the agent and the person both call it. */
  label: string;
  blurb: string;
  /** Added to the base price. The first option in each step is the base. */
  extra: number;
}

export interface Step {
  id: StepId;
  /** "Top." — Apple's statement heading: the word before the period. */
  title: string;
  lead: string;
  options: Option[];
}

export interface BagLine {
  id: string;
  top: Option;
  size: Option;
  base: Option;
  price: number;
  quantity: number;
}

export interface Coupon {
  code: string;
  label: string;
  discount: number;
}

export interface Shot {
  src: string;
  alt: string;
  caption: string;
}
