import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { signSession, verifySessionToken } from "./session-token";

const secret = "s".repeat(32);

describe("session tokens", () => {
  it("round-trips the user id and role", async () => {
    const token = await signSession({ userId: "u1", role: "ADMIN" }, secret);
    expect(await verifySessionToken(token, secret)).toEqual({ userId: "u1", role: "ADMIN" });
  });

  it("rejects a token signed with another secret", async () => {
    const token = await signSession({ userId: "u1", role: "ADMIN" }, "o".repeat(32));
    expect(await verifySessionToken(token, secret)).toBeNull();
  });

  it("rejects a tampered token", async () => {
    const token = await signSession({ userId: "u1", role: "USER" }, secret);
    const [header, , signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "u1", role: "ADMIN" })).toString("base64url");
    expect(await verifySessionToken(`${header}.${forged}.${signature}`, secret)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const expired = await new SignJWT({ role: "USER" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("u1")
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(secret));
    expect(await verifySessionToken(expired, secret)).toBeNull();
  });

  it("rejects a missing token and an empty secret", async () => {
    expect(await verifySessionToken(undefined, secret)).toBeNull();
    const token = await signSession({ userId: "u1", role: "USER" }, secret);
    expect(await verifySessionToken(token, "")).toBeNull();
  });
});
