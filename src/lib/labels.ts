// Display names for the enums in prisma/schema.prisma. Kept free of Prisma
// imports so client components can use them.

export const DIRECTIONS = ["INCOMING", "OUTGOING", "TRANSFER"] as const;
export const METHODS = ["CASH", "BANK_TRANSFER", "CARD", "MOBILE_PAYMENT", "CRYPTO", "OTHER"] as const;
export const ACCOUNT_TYPES = ["PIGGY_BANK", "CASH", "BANK", "CARD", "OTHER"] as const;

export type DirectionValue = (typeof DIRECTIONS)[number];
export type MethodValue = (typeof METHODS)[number];
export type AccountTypeValue = (typeof ACCOUNT_TYPES)[number];

export const DIRECTION_LABELS: Record<DirectionValue, string> = {
  INCOMING: "Money in",
  OUTGOING: "Money out",
  TRANSFER: "Transfer between accounts",
};

export const METHOD_LABELS: Record<MethodValue, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank transfer",
  CARD: "Card",
  MOBILE_PAYMENT: "Mobile payment",
  CRYPTO: "Crypto",
  OTHER: "Other",
};

export const ACCOUNT_TYPE_LABELS: Record<AccountTypeValue, string> = {
  PIGGY_BANK: "Piggy bank",
  CASH: "Cash wallet",
  BANK: "Bank account",
  CARD: "Card",
  OTHER: "Other",
};

/** The currencies offered in forms; any ISO 4217 code is accepted. */
export const COMMON_CURRENCIES = ["TRY", "USD", "EUR", "GBP"] as const;
