import { createReadStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { env } from '../../config/env.js';

/**
 * Storage driver contract. Business code never touches the filesystem directly, so an S3-compatible
 * driver can replace the local one without changing modules (blocked until bucket credentials exist).
 */
export interface StorageDriver {
  readonly name: string;
  /** Moves an already-written temporary file into permanent storage under `key`. */
  putFromTempFile(tempPath: string, key: string): Promise<void>;
  /** Absolute path for efficient range-capable streaming (local driver only). */
  localPath?(key: string): string;
  read(key: string): Readable;
  remove(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  tempDir(): string;
}

class LocalDiskStorage implements StorageDriver {
  readonly name = 'local';
  private readonly root = path.resolve(env.STORAGE_DIR);

  private resolveKey(key: string): string {
    // Keys are generated server-side, but guard against traversal regardless.
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error('Invalid storage key');
    return full;
  }
  tempDir(): string {
    return path.join(this.root, 'tmp');
  }
  async putFromTempFile(tempPath: string, key: string): Promise<void> {
    const dest = this.resolveKey(key);
    await mkdir(path.dirname(dest), { recursive: true });
    await rename(tempPath, dest);
  }
  localPath(key: string): string {
    return this.resolveKey(key);
  }
  read(key: string): Readable {
    return createReadStream(this.resolveKey(key));
  }
  async remove(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true });
  }
  async exists(key: string): Promise<boolean> {
    return stat(this.resolveKey(key)).then(
      () => true,
      () => false,
    );
  }
}

export const storage: StorageDriver = new LocalDiskStorage();

export async function ensureStorageReady(): Promise<void> {
  await mkdir(storage.tempDir(), { recursive: true });
}
