/** Formats an amount (number, string or Prisma Decimal) in its currency, e.g. "$20.00". */
export function formatMoney(amount: { toString(): string } | number, currency: string, locale = "en-US") {
  const value = typeof amount === "number" ? amount : Number(amount.toString());
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

const CURRENCY_CODES = new Set(Intl.supportedValuesOf("currency"));

/** True for a real ISO 4217 currency code such as "USD" or "TRY". */
export function isCurrencyCode(code: string): boolean {
  return CURRENCY_CODES.has(code);
}
