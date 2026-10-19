import { currentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { readReceipt } from "@/lib/receipts";
import { receiptStorage } from "@/lib/storage";

/** Browsers can show these inline; anything else (HEIC) is downloaded. */
const INLINE = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export async function GET(request: Request, { params }: RouteContext<"/receipts/[id]">) {
  const user = await currentUser();
  const { id } = await params;
  const found = await readReceipt(db, receiptStorage(), user, id);
  if (!found) return new Response("Not found", { status: 404 });

  const { receipt, bytes } = found;
  const download = new URL(request.url).searchParams.has("download") || !INLINE.has(receipt.mimeType);
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": receipt.mimeType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(receipt.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    },
  });
}
