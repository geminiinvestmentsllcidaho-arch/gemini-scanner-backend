import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function read(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function listFiles(dir) {
  try {
    return fs.readdirSync(dir)
      .map((name) => path.join(dir, name))
      .filter((file) => {
        try { return fs.statSync(file).isFile(); } catch { return false; }
      });
  } catch {
    return [];
  }
}

function routeBlock(text, route) {
  const idx = text.indexOf(route);
  if (idx < 0) return "";
  return text.slice(Math.max(0, idx - 120), Math.min(text.length, idx + 900));
}

const nginxFiles = [
  ...listFiles("/etc/nginx/sites-enabled"),
  ...listFiles("/etc/nginx/conf.d"),
];

const nginxText = nginxFiles
  .map((file) => "\n# " + file + "\n" + read(file))
  .join("\n");

const sensitivePublicRoutes = [];
for (const route of ["/ops/", "/runlog", "/operator"]) {
  const block = routeBlock(nginxText, route);
  if (block && /auth_basic\s+off\s*;/i.test(block)) {
    sensitivePublicRoutes.push(route);
  }
}

const defaultSiteEnabled = nginxFiles.some((file) => path.basename(file) === "default");

const sshText = [
  read("/etc/ssh/sshd_config"),
  ...listFiles("/etc/ssh/sshd_config.d").map(read),
].join("\n");

const ssh = {
  permitRootLoginNo: /^\s*PermitRootLogin\s+no\s*$/mi.test(sshText),
  passwordAuthenticationNo: /^\s*PasswordAuthentication\s+no\s*$/mi.test(sshText),
  pubkeyAuthenticationYes: /^\s*PubkeyAuthentication\s+yes\s*$/mi.test(sshText),
  x11ForwardingNo: /^\s*X11Forwarding\s+no\s*$/mi.test(sshText),
};

const ss = spawnSync("ss", ["-tulpn"], { encoding: "utf8" });
const listeningText = ss.stdout || "";
const publicNode3000 = /\s0\.0\.0\.0:3000\b|\s\[::\]:3000\b/.test(listeningText);

const rebootRequired =
  fs.existsSync("/var/run/reboot-required") || fs.existsSync("/run/reboot-required");

const repoEnvPermission = (() => {
  try {
    return (fs.statSync(path.join(process.cwd(), ".env")).mode & 0o777).toString(8);
  } catch {
    return null;
  }
})();

const backupRoot = path.join(process.env.HOME || "", ".gemini-scanner-secret-backups");
const backupPermissionFindings = [];
function scanBackupPermissions(dir, depth = 0) {
  if (!dir || depth > 5) return;
  let entries = [];
  try {
    const stat = fs.statSync(dir);
    const mode = stat.mode & 0o777;
    if (stat.isDirectory() && mode !== 0o700) {
      backupPermissionFindings.push({ path: dir, type: "directory", mode: mode.toString(8) });
    }
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    try {
      const stat = fs.statSync(full);
      const mode = stat.mode & 0o777;
      if (entry.isDirectory()) {
        if (mode !== 0o700) {
          backupPermissionFindings.push({ path: full, type: "directory", mode: mode.toString(8) });
        }
        scanBackupPermissions(full, depth + 1);
      } else if (entry.isFile() && mode !== 0o600) {
        backupPermissionFindings.push({ path: full, type: "file", mode: mode.toString(8) });
      }
    } catch {
      continue;
    }
  }
}
scanBackupPermissions(backupRoot);

const pm2Root = path.join(process.env.HOME || "", ".pm2");
const pm2PermissionFindings = [];
function scanPm2Permissions(dir) {
  if (!dir) return;
  let entries = [];
  try {
    const stat = fs.statSync(dir);
    const mode = stat.mode & 0o777;
    if (stat.isDirectory() && mode !== 0o700) {
      pm2PermissionFindings.push({ path: dir, type: "directory", mode: mode.toString(8) });
    }
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    try {
      const stat = fs.statSync(full);
      const mode = stat.mode & 0o777;
      if (entry.isDirectory()) {
        if (mode !== 0o700) {
          pm2PermissionFindings.push({ path: full, type: "directory", mode: mode.toString(8) });
        }
      } else if (entry.isFile() && mode !== 0o600) {
        pm2PermissionFindings.push({ path: full, type: "file", mode: mode.toString(8) });
      }
    } catch {
      continue;
    }
  }
}
scanPm2Permissions(pm2Root);

const repoBackupTempFiles = [];
const BACKUP_TEMP_FILE_RE = /(?:^\.npmrc$|^\.netrc$|^\.git-credentials$|^id_rsa$|^id_ed25519$|\.bak(?:\.|$)|\.old(?:\.|$)|\.orig(?:\.|$)|\.tmp$|\.(?:pem|key|p12|pfx)$)/i;

function scanBackupTempFiles(dir, depth = 0) {
  if (depth > 3) return;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) scanBackupTempFiles(full, depth + 1);
    if (entry.isFile() && BACKUP_TEMP_FILE_RE.test(entry.name)) {
      repoBackupTempFiles.push(full.replace(process.cwd() + "/", "./"));
    }
  }
}
scanBackupTempFiles(process.cwd());

const envFileNamesOnly = [];
function scanEnv(dir, depth = 0) {
  if (depth > 2) return;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) scanEnv(full, depth + 1);
    if (entry.isFile() && entry.name.startsWith(".env")) {
      envFileNamesOnly.push(full.replace(process.cwd() + "/", "./"));
    }
  }
}
scanEnv(process.cwd());

const issues = [];
if (sensitivePublicRoutes.length) issues.push("NGINX_PUBLIC_SENSITIVE_ROUTES");
if (defaultSiteEnabled) issues.push("NGINX_DEFAULT_SITE_ENABLED");
if (publicNode3000) issues.push("NODE_PORT_3000_PUBLICLY_BOUND");
if (!ssh.x11ForwardingNo) issues.push("SSH_X11_FORWARDING_NOT_DISABLED");
if (rebootRequired) issues.push("SYSTEM_REBOOT_REQUIRED");
if (repoEnvPermission && repoEnvPermission !== "600") issues.push("ENV_FILE_PERMISSION_TOO_OPEN");
if (backupPermissionFindings.length) issues.push("SECRET_BACKUP_PERMISSION_TOO_OPEN");
if (pm2PermissionFindings.length) issues.push("PM2_PERMISSION_TOO_OPEN");
if (envFileNamesOnly.some((file) => /\.bak/i.test(file))) issues.push("ENV_BACKUP_FILES_PRESENT");
if (repoBackupTempFiles.length) issues.push("REPO_BACKUP_TEMP_FILES_PRESENT");

const report = {
  ok: issues.length === 0,
  version: "security_ops_surface_audit_v1",
  mode: "readonly-security-ops-surface-audit",
  nginx: {
    files: nginxFiles,
    defaultSiteEnabled,
    sensitivePublicRoutes,
  },
  network: {
    publicNode3000,
  },
  ssh,
  system: {
    rebootRequired,
  },
  secrets: {
    envFileNamesOnly: envFileNamesOnly.sort(),
    envBackupFilesPresent: envFileNamesOnly.some((file) => /\.bak/i.test(file)),
    repoEnvPermission,
    backupRoot,
    backupPermissionFindings: backupPermissionFindings
      .map((finding) => ({
        ...finding,
        path: finding.path.replace((process.env.HOME || "") + "/", "~/"),
      }))
      .sort((a, b) => a.path.localeCompare(b.path)),
    backupPermissionsOk: backupPermissionFindings.length === 0,
    pm2Root,
    pm2PermissionFindings: pm2PermissionFindings
      .map((finding) => ({
        ...finding,
        path: finding.path.replace((process.env.HOME || "") + "/", "~/"),
      }))
      .sort((a, b) => a.path.localeCompare(b.path)),
    pm2PermissionsOk: pm2PermissionFindings.length === 0,
  },
  sourceSurface: {
    repoBackupTempFiles: repoBackupTempFiles.sort(),
    repoBackupTempFilesPresent: repoBackupTempFiles.length > 0,
  },
  issues,
};

console.log(JSON.stringify(report, null, 2));

if (!report.ok) process.exitCode = 2;
