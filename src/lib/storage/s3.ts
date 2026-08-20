import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import type { StorageDriver } from "@/lib/storage";

/**
 * S3-compatible storage: Cloudflare R2, AWS S3, MinIO, Backblaze B2.
 *
 * This exists because every host worth deploying to has an ephemeral
 * filesystem. Local disk is correct for development and for a single box you
 * own; it loses every guest photo on the next deploy anywhere else, which is
 * not a failure mode a wedding gets to have.
 *
 * R2 is the default target: its free tier is 10 GB with **no egress charge**,
 * and this app's whole job on the read side is serving photos back. On S3 the
 * same gallery costs per view.
 *
 * The bucket must stay private. Objects are fetched by the server and passed
 * through an access-checked route, exactly as with local disk — that is what
 * keeps a hidden photo unreachable. A public bucket would hand out permanent
 * URLs that no moderation decision could withdraw.
 */
export class S3Storage implements StorageDriver {
  readonly name: string;
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(options: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    /** R2/MinIO need this. AWS does not — leave it unset there. */
    endpoint?: string;
    /** MinIO and some proxies serve buckets as a path segment, not a subdomain. */
    forcePathStyle?: boolean;
    name?: string;
  }) {
    this.name = options.name ?? "s3";
    this.bucket = options.bucket;

    const config: S3ClientConfig = {
      region: options.region,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    };
    if (options.endpoint) config.endpoint = options.endpoint;
    if (options.forcePathStyle) config.forcePathStyle = true;

    this.client = new S3Client(config);
  }

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: bytes,
        ContentType: contentType,
      }),
    );
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!response.Body) return null;
      return new Uint8Array(await response.Body.transformToByteArray());
    } catch (error) {
      // A missing object is a null, matching the local driver, so callers do
      // not need to know which driver is behind them. Anything else — denied
      // credentials, a wrong bucket, a network fault — must surface, because
      // treating those as "not found" would quietly serve 404s for files that
      // are sitting there intact.
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    // S3 deletes are idempotent: removing an absent key succeeds, which is the
    // behaviour `rm --force` gives the local driver.
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}

/**
 * Whether an error means "no such object".
 *
 * Checked three ways because the SDK, R2 and MinIO do not agree: the SDK raises
 * a `NoSuchKey` named error, R2 sometimes answers a bare 404, and a GET against
 * a bucket the key is missing from can arrive as `NotFound`.
 */
function isNotFound(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    candidate.name === "NoSuchKey" ||
    candidate.name === "NotFound" ||
    candidate.Code === "NoSuchKey" ||
    candidate.$metadata?.httpStatusCode === 404
  );
}
