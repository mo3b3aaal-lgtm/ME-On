/**
 * Accurate Monetary & Currency Arithmetic Utility
 *
 * Ensures precise decimal handling for fractional prices (e.g. 10.5, 112.5, 125.5),
 * preventing premature integer rounding before session multiplication and avoiding
 * floating-point drift in JavaScript (e.g. 112.5 * 2 = 225, 112.5 * 3 = 337.5).
 */

/**
 * Rounds a currency amount to a specified decimal precision (default: 2 decimal places).
 * Handles floating-point epsilon safely.
 */
export function roundMoney(val: number, decimals: number = 2): number {
  if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

/**
 * Multiplies an exact unit/session price by a quantity or session count,
 * preserving decimals and rounding only at the final stage.
 *
 * Examples:
 * - 10.5 * 2 = 21 (NOT 22)
 * - 112.5 * 2 = 225 (NOT 226)
 * - 10.5 * 3 = 31.5
 * - 112.5 * 3 = 337.5
 */
export function multiplyMoney(price: number, quantity: number, decimals: number = 2): number {
  if (!price || !quantity) return 0;
  return roundMoney(price * quantity, decimals);
}

/**
 * Divides a total package or period price by session count or unit without premature integer truncation.
 *
 * Examples:
 * - 225 / 2 = 112.5 (NOT 113)
 * - 21 / 2 = 10.5 (NOT 11)
 * - 900 / 8 = 112.5 (NOT 113)
 */
export function divideMoney(total: number, count: number, decimals: number = 2): number {
  if (!total || !count || count <= 0) return 0;
  return roundMoney(total / count, decimals);
}

/**
 * Adds multiple monetary amounts safely.
 */
export function addMoney(...amounts: (number | undefined | null)[]): number {
  const sum = amounts.reduce<number>((acc, curr) => acc + (typeof curr === 'number' && !isNaN(curr) ? curr : 0), 0);
  return roundMoney(sum, 2);
}

/**
 * Subtracts one monetary amount from another safely.
 */
export function subtractMoney(a: number, b: number): number {
  const numA = typeof a === 'number' && !isNaN(a) ? a : 0;
  const numB = typeof b === 'number' && !isNaN(b) ? b : 0;
  return roundMoney(numA - numB, 2);
}

/**
 * Calculates how many full sessions a payment covers at a given rate.
 */
export function calculateCoveredSessions(paymentAmount: number, sessionRate: number): number {
  if (!sessionRate || sessionRate <= 0 || !paymentAmount || paymentAmount <= 0) return 0;
  // Floor to whole integer session count
  return Math.floor(roundMoney(paymentAmount / sessionRate, 4));
}

/**
 * Calculates financial remainder safely without float modulo errors.
 * e.g. 230 paid at 112.5/session covers 2 sessions (225) with 5 remainder.
 */
export function calculateMoneyRemainder(paymentAmount: number, sessionRate: number): number {
  if (!sessionRate || sessionRate <= 0 || !paymentAmount || paymentAmount <= 0) return 0;
  const covered = calculateCoveredSessions(paymentAmount, sessionRate);
  const remainder = paymentAmount - (covered * sessionRate);
  return Math.max(0, roundMoney(remainder, 2));
}

/**
 * Formats a monetary number cleanly:
 * - Whole integers: "225", "21"
 * - Decimals: "112.5", "10.5", "337.5", "31.25"
 */
export function formatMoney(val: number): string {
  const rounded = roundMoney(val, 2);
  if (Number.isInteger(rounded)) {
    return rounded.toString();
  }
  return rounded.toFixed(2).replace(/\.?0+$/, '');
}
