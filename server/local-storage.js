import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export function createLocalStorage(rootDirectory) {
  const root = resolve(rootDirectory);
  const pathFor = key => {
    if (typeof key !== 'string' || !/^(photo|verification)\/[a-f0-9-]+\/[a-f0-9-]+$/.test(key)) throw new Error('Invalid upload key');
    const target = resolve(join(root, key));
    if (!target.startsWith(`${root}/`)) throw new Error('Invalid upload path');
    return target;
  };
  return {
    async put(key, bytes) { const target = pathFor(key); await mkdir(join(target, '..'), { recursive: true }); await writeFile(target, bytes, { flag: 'wx' }); },
    get(key) { return readFile(pathFor(key)); },
    async remove(key) { try { await unlink(pathFor(key)); } catch (error) { if (error.code !== 'ENOENT') throw error; } },
  };
}
