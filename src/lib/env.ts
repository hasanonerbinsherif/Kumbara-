import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url().refine((url) => /^postgres(ql)?:\/\//.test(url), {
    message: "DATABASE_URL must be a postgresql:// connection string",
  }),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  BASE_CURRENCY: z
    .string()
    .regex(/^[A-Z]{3}$/, "BASE_CURRENCY must be a 3-letter ISO 4217 code")
    .default("USD"),
  HOME_CURRENCY: z
    .string()
    .regex(/^[A-Z]{3}$/, "HOME_CURRENCY must be a 3-letter ISO 4217 code")
    .default("TRY"),
  RATES_API_URL: z.url().default("https://api.frankfurter.app"),
  /** Protects /api/cron/rates; the daily job sends it as "Authorization: Bearer <secret>". */
  CRON_SECRET: z.string().min(32, "CRON_SECRET must be at least 32 characters").optional(),
  RECEIPTS_DIR: z.string().min(1).default("storage/receipts"),
  STORAGE_ENDPOINT: z.url().optional(),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  // An empty value (KEY="" as in .env.example) means "not set", so defaults and optionals apply.
  const set = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ""));
  const result = envSchema.safeParse(set);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${problems}`);
  }
  return result.data;
}

let cached: Env | undefined;

export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
