import fs from 'node:fs';

// Administrative display only. Oversized records outside this window are omitted.
export function readBoundedTextTail(file, count = 8, { maxBytes = 1024 * 1024 } = {}) {
  let fd;
  try {
    if (!Number.isSafeInteger(count) || count < 1 || count > 1000 ||
        !Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 1024 * 1024) return [];
    fd = fs.openSync(file, 'r');
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) return [];
    const size = Math.min(stat.size, maxBytes), offset = stat.size - size;
    const buffer = Buffer.alloc(size);
    if (fs.readSync(fd, buffer, 0, size, offset) !== size) return [];
    // Drop a possibly incomplete first line, including a split UTF-8 character.
    const first = offset > 0 ? buffer.indexOf(10) + 1 : 0;
    if (offset > 0 && first === 0) return [];
    return buffer.subarray(first).toString('utf8').split(/\r?\n/).filter(Boolean).slice(-count);
  } catch { return []; }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}
