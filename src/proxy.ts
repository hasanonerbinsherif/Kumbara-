import { type NextRequest, NextResponse } from "next/server";
import { decideRoute } from "@/lib/access";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";

export default async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token, process.env.AUTH_SECRET ?? "");
  const decision = decideRoute(request.nextUrl.pathname, session);

  if (decision.kind === "redirect") {
    return NextResponse.redirect(new URL(decision.to, request.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  // Skip API routes, Next.js internals and static files.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
