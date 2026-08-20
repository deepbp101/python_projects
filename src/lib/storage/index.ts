import { randomBytes } from "node:crypto";
import { LocalDiskStorage } from "@/lib/storage/local";
import { S3Storage } from "@/lib/storage/s3";
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
 * Local disk is the default, which is right for development and for a single
 * box you own. Anywhere with an ephemeral filesystem needs "s3" — R2, S3,
 * MinIO, B2 — or every guest photo is lost on the next deploy.
 *
 * A misconfigured driver throws at first use rather than silently dropping
 * uploads, and each missing variable is named, because "storage is broken" at
 * 11pm the night before a wedding is not a debuggable message.
 */
export function getStorage(): StorageDriver {
  if (cached) return cached;

  const driver = process.env.STORAGE_DRIVER ?? "local";

  if (driver === "local") {
    cached = new LocalDiskStorage(process.env.UPLOAD_DIR ?? ".uploads");
    return cached;
  }

  if (driver === "s3") {
    cached = new S3Storage({
      bucket: required("S3_BUCKET"),
      accessKeyId: required("S3_ACCESS_KEY_ID"),
      secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
      // R2 ignores the region but the SDK insists on one; "auto" is what
      // Cloudflare's own examples use.
      region: process.env.S3_REGION ?? "auto",
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    });
    return cached;
  }

  throw new Error(
    `Unknown STORAGE_DRIVER "${driver}". Use "local" or "s3", or implement StorageDriver and register it here.`,
  );
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. STORAGE_DRIVER="s3" needs S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY (plus S3_ENDPOINT on R2 or MinIO).`,
    );
  }
  return value;
}

/** Only for tests: forgets the memoised driver so env changes take effect. */
export function resetStorageForTests(): void {
  cached = undefined;
}
