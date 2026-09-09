import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import type { StorageDriver } from "@/lib/storage";

/**
 * Local disk driver, for development and single-server deployments.
 *
 * Files land outside the repo tree by default (`.uploads/`) and are served
 * through an authenticated route rather than as static assets, so mood board
 * images stay private until the couple shares them.
 */
export class LocalDiskStorage implements StorageDriver {
  readonly name = "local";
  private readonly root: string;

  constructor(root: string) {
    // turbopackIgnore keeps the bundler's file tracer from walking the whole
    // project because the upload directory is only known at runtime.
    this.root = resolve(/* turbopackIgnore: true */ process.cwd(), root);
  }

  /**
   * Resolves a key to an absolute path and refuses anything that escapes the
   * root. Keys are server-generated, so this is defence in depth rather than
   * the primary control.
   */
  private pathFor(key: string): string {
    const full = resolve(join(this.root, key));
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new Error("Refusing to resolve a storage key outside the root.");
    }
    return full;
  }

  async put(key: string, bytes: Uint8Array): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      return new Uint8Array(await readFile(this.pathFor(key)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }
}
