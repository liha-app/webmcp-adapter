export type StepId = 'chip' | 'memory' | 'storage';

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
  /** "Chip." — Apple's statement heading, the word before the period. */
  title: string;
  lead: string;
  options: Option[];
}

export interface BagLine {
  id: string;
  chip: Option;
  memory: Option;
  storage: Option;
  price: number;
}

export interface Coupon {
  code: string;
  label: string;
  discount: number;
}
