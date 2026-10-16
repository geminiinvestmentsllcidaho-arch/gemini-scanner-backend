import fs from 'node:fs';

// Local SSH-owned file request, never a network order endpoint. Claim remains
// after failure/restart so a request cannot be executed again automatically.
export function consumeDiagnosticRequest({ requestFile, claimedFile, now = Date.now,
  expectedUid = process.getuid?.(), requirePosixPermissions = true }) {
  if (fs.existsSync(claimedFile)) return null;
  let stat;
  try { stat = fs.lstatSync(requestFile); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096) throw Error('diagnostic_request_file_invalid');
  if (requirePosixPermissions && (expectedUid === undefined || stat.uid !== expectedUid || (stat.mode & 0o077) !== 0)) throw Error('diagnostic_request_permissions_invalid');
  // Validate and read the same opened inode, rather than re-opening by path
  // after the permission check. Production POSIX reads also reject symlinks.
  let inputFd, text;
  try {
    inputFd = fs.openSync(requestFile, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    const opened = fs.fstatSync(inputFd);
    if (!opened.isFile() || opened.dev !== stat.dev || opened.ino !== stat.ino ||
        opened.size > 4096 || (requirePosixPermissions &&
          (opened.uid !== expectedUid || (opened.mode & 0o077) !== 0))) throw Error('diagnostic_request_file_changed');
    const buffer = Buffer.alloc(4097);
    const bytes = fs.readSync(inputFd, buffer, 0, buffer.length, 0);
    if (bytes > 4096) throw Error('diagnostic_request_file_invalid');
    text = buffer.subarray(0, bytes).toString('utf8');
  } finally { if (inputFd !== undefined) fs.closeSync(inputFd); }
  const request = JSON.parse(text);
  const expiry = Date.parse(request.expiresAt), time = now();
  if (request.version !== 1 || request.action !== 'ONE_PAPER_DIAGNOSTIC_ENTRY' ||
      request.accountIdentity !== 'alpaca-paper:feba75c3f7774226bd2c667b' ||
      !request.experimentId || !request.lifecycleId || !request.clientOrderId ||
      !Number.isFinite(time) || !Number.isFinite(expiry) || expiry <= time || expiry - time > 900000) throw Error('diagnostic_request_invalid');
  // Exclusive claim handles competing consumers without overwriting old claims.
  let fd;
  try { fd = fs.openSync(claimedFile, 'wx', 0o600); fs.writeFileSync(fd, JSON.stringify(request) + '\n'); fs.fsyncSync(fd); }
  finally { if (fd !== undefined) fs.closeSync(fd); }
  return Object.freeze(request);
}
