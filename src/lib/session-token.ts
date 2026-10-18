import { jwtVerify, SignJWT } from "jose";

export type Role = "ADMIN" | "USER";

export type SessionPayload = {
  userId: string;
  role: Role;
};

export const SESSION_COOKIE = "kumbara_session";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

function key(secret: string) {
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(key(secret));
}

/** Returns the session, or null when the token is missing, tampered with or expired. */
export async function verifySessionToken(
  token: string | undefined,
  secret: string,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"] });
    if (!payload.sub || (payload.role !== "ADMIN" && payload.role !== "USER")) return null;
    return { userId: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}
