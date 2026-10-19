import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

/**
 * Where receipt files live. Local disk today; an S3/R2 implementation can be
 * added later behind the same interface without touching callers.
 */
export interface FileStorage {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
}

const SAFE_KEY = /^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/;

export class LocalDiskStorage implements FileStorage {
  private readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  /** Maps a key to a path under root, refusing anything that could escape it. */
  private pathFor(key: string): string {
    if (!SAFE_KEY.test(key) || key.split("/").includes("..")) throw new Error(`Invalid storage key: ${key}`);
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error(`Invalid storage key: ${key}`);
    return full;
  }

  async put(key: string, bytes: Uint8Array) {
    const file = this.pathFor(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes, { flag: "wx" }); // never overwrite an existing receipt
  }

  async get(key: string) {
    try {
      return new Uint8Array(await readFile(this.pathFor(key)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async delete(key: string) {
    await rm(this.pathFor(key), { force: true });
  }
}

let storage: FileStorage | undefined;

export function receiptStorage(): FileStorage {
  storage ??= new LocalDiskStorage(env().RECEIPTS_DIR);
  return storage;
}
