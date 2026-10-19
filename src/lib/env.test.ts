import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const valid = {
  DATABASE_URL: "postgresql://kumbara:kumbara@localhost:5432/kumbara",
  AUTH_SECRET: "x".repeat(32),
};

describe("parseEnv", () => {
  it("accepts the minimum required variables and fills defaults", () => {
    const env = parseEnv(valid);
    expect(env.BASE_CURRENCY).toBe("USD");
    expect(env.HOME_CURRENCY).toBe("TRY");
    expect(env.RATES_API_URL).toBe("https://api.frankfurter.app");
  });

  it("treats empty values from .env.example as not set", () => {
    const env = parseEnv({ ...valid, HOME_CURRENCY: "", STORAGE_ENDPOINT: "", CRON_SECRET: "" });
    expect(env.HOME_CURRENCY).toBe("TRY");
    expect(env.STORAGE_ENDPOINT).toBeUndefined();
    expect(env.CRON_SECRET).toBeUndefined();
  });

  it("rejects a non-Postgres DATABASE_URL", () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: "mysql://localhost/db" })).toThrow(
      /DATABASE_URL/,
    );
  });

  it("rejects a short AUTH_SECRET", () => {
    expect(() => parseEnv({ ...valid, AUTH_SECRET: "too-short" })).toThrow(/AUTH_SECRET/);
  });

  it("rejects a currency that is not a 3-letter code", () => {
    expect(() => parseEnv({ ...valid, HOME_CURRENCY: "lira" })).toThrow(/HOME_CURRENCY/);
  });

  it("lists every missing variable at once", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL[\s\S]*AUTH_SECRET/);
  });
});
