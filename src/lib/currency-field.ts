import { z } from "zod";
import { isCurrencyCode } from "@/lib/money";

/** A form field holding an ISO 4217 code; trims and upper-cases what people type. */
export const currencyField = z
  .string()
  .trim()
  .toUpperCase()
  .refine(isCurrencyCode, "Use a real currency code such as TRY, USD or EUR");
