import { randomBytes } from "node:crypto";
import { LocalDiskStorage } from "@/lib/storage/local";
import type { StoredFormat } from "@/lib/storage/files";
import { extensionForStored } from "@/lib/storage/files";

/**
 * Storage driver contract.
 *
 * Everything above this layer deals only in opaque keys, so swapping local disk
 * for S3/R2/MinIO is a driver change and nothing else. Keys are always
 * generated server-side by `buildStorageKey` — a user-supplied name never
 * reaches the filesystem or a bucket path.
 */
export interface StorageDriver {
  readonly name: string;
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
}

export function buildStorageKey(
  weddingId: string,
  format: StoredFormat,
): string {
  return `weddings/${weddingId}/${randomBytes(16).toString("hex")}.${extensionForStored(format)}`;
}

let cached: StorageDriver | undefined;

/**
 * Resolves the configured driver.
 *
 * Local disk is the default and the only driver implemented so far; see the
 * storage section of the README for what an S3-compatible driver needs to
 * satisfy. A misconfigured STORAGE_DRIVER fails loudly at first use rather than
 * silently dropping uploads.
 */
export function getStorage(): StorageDriver {
  if (cached) return cached;

  const driver = process.env.STORAGE_DRIVER ?? "local";
  if (driver !== "local") {
    throw new Error(
      `Unknown STORAGE_DRIVER "${driver}". Only "local" ships today; implement StorageDriver and register it here to add another.`,
    );
  }

  cached = new LocalDiskStorage(process.env.UPLOAD_DIR ?? ".uploads");
  return cached;
}
