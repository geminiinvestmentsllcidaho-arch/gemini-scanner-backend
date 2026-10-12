import fs from 'node:fs';
import { StringDecoder } from 'node:string_decoder';

// Keep memory proportional to the records inspected, rather than the ledger.
// Watchdogs differ in whether malformed/falsy records are skipped.
export function readLatestJsonlValue(filePath, { skipInvalid = false, trimEmpty = false } = {}) {
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    let offset = fs.fstatSync(fd).size;
    let parts = [];
    let endsWithNewline = false;
    const prefixIsWhitespace = length => {
      const decoder = new StringDecoder('utf8');
      for (let position = 0; position < length;) {
        const size = Math.min(length - position, 64 * 1024);
        const buffer = Buffer.allocUnsafe(size);
        if (fs.readSync(fd, buffer, 0, size, position) !== size) return false;
        if (decoder.write(buffer).trim().length) return false;
        position += size;
      }
      return !decoder.end().trim().length;
    };
    const inspect = (firstLine = false, start = 0) => {
      let line = Buffer.concat(parts.reverse()).toString('utf8');
      if (endsWithNewline && line.endsWith('\r')) line = line.slice(0, -1);
      // Match trimming the whole infrastructure ledger: only its outer
      // edges are trimmed, so a BOM inside the file remains malformed.
      if (trimEmpty) {
        line = line.trimEnd();
        if (firstLine) line = line.trimStart();
      }
      if (!line.length) return { done: false };
      try {
        const value = JSON.parse(line);
        return skipInvalid && !value ? { done: false } : { done: true, value };
      } catch {
        // Whole-file trim can reach this record through preceding whitespace.
        // Check that prefix only for an otherwise-invalid leading BOM/space.
        if (trimEmpty && !firstLine && line !== line.trimStart() && prefixIsWhitespace(start)) {
          try { return { done: true, value: JSON.parse(line.trimStart()) }; } catch {}
        }
        return { done: !skipInvalid, value: null };
      }
    };
    while (offset > 0) {
      const size = Math.min(offset, 64 * 1024);
      offset -= size;
      const buffer = Buffer.allocUnsafe(size);
      if (fs.readSync(fd, buffer, 0, size, offset) !== size) return null;
      let end = size;
      for (let i = size - 1; i >= 0; i -= 1) {
        if (buffer[i] !== 10) continue;
        parts.push(buffer.subarray(i + 1, end));
        const result = inspect(false, offset + i + 1);
        if (result.done) return result.value;
        parts = [];
        endsWithNewline = true;
        end = i;
      }
      parts.push(buffer.subarray(0, end));
    }
    return inspect(true).value ?? null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}
