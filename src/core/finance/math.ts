/**
 * Financial calculations used by the offline story engine. Every number the
 * engine narrates comes from these functions with explicitly stated assumptions.
 */

/** Value of a lump sum after `years` at annual rate `r`, compounded annually. */
export function futureValueLump(principal: number, r: number, years: number): number {
  return principal * (1 + r) ** years;
}

/** Value of a monthly contribution after `years` at annual rate `r`, compounded monthly. */
export function futureValueMonthly(monthly: number, r: number, years: number): number {
  const i = r / 12;
  const n = Math.round(years * 12);
  if (i === 0) return monthly * n;
  return monthly * (((1 + i) ** n - 1) / i);
}

export interface PayoffResult {
  months: number;
  totalInterest: number;
  totalPaid: number;
  firstPayment: number;
  firstInterest: number;
  paidOff: boolean;
}

/** Revolving-credit payoff paying only the minimum (pct of balance, with an absolute floor). */
export function payoffMinimum(balance: number, apr: number, minPct: number, minAbs: number, maxMonths = 1200): PayoffResult {
  return simulatePayoff(balance, apr, (b) => Math.max(minAbs, b * minPct), maxMonths);
}

/** Payoff with a fixed monthly payment. */
export function payoffFixed(balance: number, apr: number, payment: number, maxMonths = 1200): PayoffResult {
  return simulatePayoff(balance, apr, () => payment, maxMonths);
}

function simulatePayoff(balance: number, apr: number, paymentFor: (b: number) => number, maxMonths: number): PayoffResult {
  const i = apr / 12;
  let b = balance;
  let months = 0;
  let totalInterest = 0;
  let totalPaid = 0;
  let firstPayment = 0;
  let firstInterest = 0;
  while (b > 0.005 && months < maxMonths) {
    const interest = b * i;
    b += interest;
    const pay = Math.min(b, paymentFor(b - interest));
    if (months === 0) {
      firstPayment = pay;
      firstInterest = interest;
    }
    if (pay <= interest && months > 0) break; // never pays off
    b -= pay;
    totalInterest += interest;
    totalPaid += pay;
    months += 1;
  }
  return { months, totalInterest, totalPaid, firstPayment, firstInterest, paidOff: b <= 0.005 };
}

/** Round to a "speakable" figure: 2 significant digits for large values, 3 for mid-size. */
export function roundFriendly(v: number): number {
  const a = Math.abs(v);
  if (a < 10) return Math.round(v * 10) / 10;
  if (a < 100) return Math.round(v);
  if (a < 1000) return Math.round(v / 10) * 10;
  if (a < 10000) return Math.round(v / 50) * 50;
  if (a < 100000) return Math.round(v / 500) * 500;
  if (a < 1e6) return Math.round(v / 5000) * 5000;
  const mag = 10 ** (Math.floor(Math.log10(a)) - 1);
  return Math.round(v / mag) * mag;
}
