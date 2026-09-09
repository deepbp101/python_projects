import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { S3Storage } from "@/lib/storage/s3";

/**
 * The S3 driver, exercised against a real HTTP server speaking enough of the S3
 * protocol to answer it.
 *
 * A mocked SDK would prove nothing: the parts that break in this driver are the
 * request the SDK actually builds (signed headers, the object path, the body)
 * and how the driver reads back a 404. Both need bytes on a socket.
 *
 * What this cannot cover is Cloudflare's own behaviour — so the checks below
 * pin the things that are the same everywhere, and R2's quirks are handled in
 * `isNotFound` by accepting all three shapes a missing object arrives in.
 */

const objects = new Map<string, { body: Buffer; contentType: string }>();
let server: Server;
let endpoint: string;
/** Every request the SDK sent, so the driver's own wiring can be asserted. */
const seen: { method: string; url: string; auth: string | undefined }[] = [];

beforeAll(async () => {
  server = createServer((request, response) => {
    const url = request.url ?? "";
    seen.push({
      method: request.method ?? "",
      url,
      auth: request.headers.authorization,
    });

    // Path-style: /<bucket>/<key…>. The query string must come off first — the
    // SDK appends ?x-id=PutObject / ?x-id=GetObject, and folding that into the
    // key makes a write and its read land in different places.
    const path = url.split("?")[0];
    const key = decodeURIComponent(path.replace(/^\/wedding-uploads\//, ""));

    if (request.method === "PUT") {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        objects.set(key, {
          body: Buffer.concat(chunks),
          contentType: request.headers["content-type"] ?? "",
        });
        response.writeHead(200, { ETag: '"stub"' }).end();
      });
      return;
    }

    if (request.method === "GET") {
      const stored = objects.get(key);
      if (!stored) {
        response
          .writeHead(404, { "Content-Type": "application/xml" })
          .end(
            `<?xml version="1.0"?><Error><Code>NoSuchKey</Code><Message>The specified key does not exist.</Message></Error>`,
          );
        return;
      }
      response
        .writeHead(200, {
          "Content-Type": stored.contentType,
          "Content-Length": String(stored.body.length),
        })
        .end(stored.body);
      return;
    }

    if (request.method === "DELETE") {
      objects.delete(key);
      response.writeHead(204).end();
      return;
    }

    response.writeHead(400).end();
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

function driver() {
  return new S3Storage({
    bucket: "wedding-uploads",
    region: "auto",
    accessKeyId: "test-key",
    secretAccessKey: "test-secret",
    endpoint,
    forcePathStyle: true,
  });
}

describe("S3Storage", () => {
  it("round-trips bytes unchanged", async () => {
    const storage = driver();
    // A PNG header plus a byte that is not valid UTF-8, so any accidental
    // string conversion in the path corrupts it visibly.
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0xff, 0x00]);

    await storage.put("weddings/w1/photo.png", bytes, "image/png");
    const read = await storage.get("weddings/w1/photo.png");

    expect(read).not.toBeNull();
    expect(Array.from(read!)).toEqual(Array.from(bytes));
  });

  it("stores the content type it was given", async () => {
    const storage = driver();
    await storage.put("weddings/w1/note.pdf", new Uint8Array([1, 2, 3]), "application/pdf");
    expect(objects.get("weddings/w1/note.pdf")?.contentType).toBe("application/pdf");
  });

  it("returns null for a missing key rather than throwing", async () => {
    // Matches LocalDiskStorage, so callers never learn which driver is behind
    // them.
    await expect(driver().get("weddings/w1/never-written.png")).resolves.toBeNull();
  });

  it("deletes, and deleting again is not an error", async () => {
    const storage = driver();
    await storage.put("weddings/w1/gone.jpg", new Uint8Array([9]), "image/jpeg");

    await storage.delete("weddings/w1/gone.jpg");
    await expect(storage.get("weddings/w1/gone.jpg")).resolves.toBeNull();

    // Idempotent, like `rm --force` on the local driver: moderation deletes a
    // photo whose bytes may already be gone.
    await expect(storage.delete("weddings/w1/gone.jpg")).resolves.toBeUndefined();
  });

  it("signs its requests and puts the key where the bucket expects it", async () => {
    seen.length = 0;
    const storage = driver();
    await storage.put("weddings/w2/deep/path.webp", new Uint8Array([1]), "image/webp");

    const put = seen.find((entry) => entry.method === "PUT");
    // Path only: the SDK appends its own ?x-id= marker, which is its business.
    expect(put?.url.split("?")[0]).toBe(
      "/wedding-uploads/weddings/w2/deep/path.webp",
    );
    // Unsigned requests are what a misconfigured client sends, and a real
    // bucket answers them with 403 rather than anything diagnosable.
    expect(put?.auth).toMatch(/^AWS4-HMAC-SHA256 /);
  });

  it("surfaces a non-404 failure instead of reporting the file missing", async () => {
    // The dangerous bug this guards: swallowing every error as "not found"
    // would serve 404s for files that exist but whose credentials were wrong.
    const broken = new S3Storage({
      bucket: "wedding-uploads",
      region: "auto",
      accessKeyId: "k",
      secretAccessKey: "s",
      // Nothing listening: a connection failure, not a missing object.
      endpoint: "http://127.0.0.1:1",
      forcePathStyle: true,
    });

    await expect(broken.get("weddings/w1/photo.png")).rejects.toThrow();
  });
});
