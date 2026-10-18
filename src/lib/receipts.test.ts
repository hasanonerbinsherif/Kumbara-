import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { sniffReceiptType } from "@/lib/receipts";
import { LocalDiskStorage } from "@/lib/storage";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));

describe("sniffReceiptType", () => {
  it("recognises receipt photos and PDFs by their contents", () => {
    expect(sniffReceiptType(bytes([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe("image/jpeg");
    expect(sniffReceiptType(bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a]))?.mime).toBe("image/png");
    expect(sniffReceiptType(bytes("RIFF", [1, 2, 3, 4], "WEBPVP8 "))?.mime).toBe("image/webp");
    expect(sniffReceiptType(bytes("%PDF-1.7\n"))?.mime).toBe("application/pdf");
    expect(sniffReceiptType(bytes([0, 0, 0, 0x18], "ftypheic"))?.mime).toBe("image/heic");
  });

  it("rejects everything else, whatever the file is called", () => {
    expect(sniffReceiptType(bytes("MZ\x90\x00"))).toBeNull(); // Windows .exe
    expect(sniffReceiptType(bytes("<svg xmlns="))).toBeNull(); // SVG can carry scripts
    expect(sniffReceiptType(bytes("<html>"))).toBeNull();
    expect(sniffReceiptType(bytes([0, 0, 0, 0x18], "ftypmp42"))).toBeNull(); // a video, not HEIC
    expect(sniffReceiptType(new Uint8Array())).toBeNull();
  });
});

describe("LocalDiskStorage", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "kumbara-storage-"));
  const storage = new LocalDiskStorage(root);
  afterAll(() => rm(root, { recursive: true, force: true }));

  it("stores, reads back and deletes files", async () => {
    await storage.put("tx1/a.pdf", bytes("%PDF-1"));
    expect(await storage.get("tx1/a.pdf")).toEqual(bytes("%PDF-1"));
    await storage.delete("tx1/a.pdf");
    expect(await storage.get("tx1/a.pdf")).toBeNull();
  });

  it("never overwrites an existing file", async () => {
    await storage.put("tx1/b.pdf", bytes("one"));
    await expect(storage.put("tx1/b.pdf", bytes("two"))).rejects.toThrow();
    expect(await storage.get("tx1/b.pdf")).toEqual(bytes("one"));
  });

  it("refuses keys that would escape its folder", async () => {
    for (const key of ["../outside", "tx1/../../outside", "/etc/passwd", "", ".hidden", "a\\..\\b"]) {
      await expect(storage.put(key, bytes("x")), key).rejects.toThrow("Invalid storage key");
      await expect(storage.get(key), key).rejects.toThrow("Invalid storage key");
    }
    expect(await readdir(path.dirname(root))).not.toContain("outside");
  });
});
