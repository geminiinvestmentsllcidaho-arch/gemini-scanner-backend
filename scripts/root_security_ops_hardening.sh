#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run as root: sudo bash scripts/root_security_ops_hardening.sh" >&2
  exit 1
fi

APP_DIR="/home/gemini/apps/gemini-scanner-backend"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="/root/gemini-scanner-security-backups/$STAMP"

echo "BEGIN ROOT SECURITY OPS HARDENING $STAMP"

mkdir -p "$BACKUP_DIR/nginx" "$BACKUP_DIR/ssh"
cp -a /etc/nginx/sites-enabled "$BACKUP_DIR/nginx/sites-enabled"
cp -a /etc/nginx/sites-available "$BACKUP_DIR/nginx/sites-available"
cp -a /etc/ssh/sshd_config "$BACKUP_DIR/ssh/sshd_config"
cp -a /etc/ssh/sshd_config.d "$BACKUP_DIR/ssh/sshd_config.d"

echo "== disable nginx default site =="
rm -f /etc/nginx/sites-enabled/default

echo "== protect sensitive GeminiScanner nginx routes =="
python3 - <<'PY'
from pathlib import Path

p = Path("/etc/nginx/sites-enabled/geminiscanner")
s = p.read_text()
routes = [
    "location ^~ /ops/",
    "location = /runlog",
    "location ^~ /operator",
]

for route in routes:
    idx = s.find(route)
    if idx < 0:
        continue
    brace = s.find("{", idx)
    if brace < 0:
        continue
    depth = 0
    end = None
    for i in range(brace, len(s)):
        if s[i] == "{":
            depth += 1
        elif s[i] == "}":
            depth -= 1
            if depth == 0:
                end = i
                break
    if end is None:
        continue
    block = s[idx:end + 1]
    block = block.replace("auth_basic off;", 'auth_basic "Restricted";')
    if "auth_basic_user_file" not in block:
        block = block.replace(
            'auth_basic "Restricted";',
            'auth_basic "Restricted";\n        auth_basic_user_file /etc/nginx/.htpasswd;'
        )
    s = s[:idx] + block + s[end + 1:]

p.write_text(s)
PY

echo "== disable ssh X11 forwarding =="
if grep -Eq '^[[:space:]]*X11Forwarding[[:space:]]+' /etc/ssh/sshd_config; then
  sed -i 's/^[[:space:]]*X11Forwarding[[:space:]].*/X11Forwarding no/' /etc/ssh/sshd_config
else
  printf '\nX11Forwarding no\n' >> /etc/ssh/sshd_config
fi

echo "== config tests =="
nginx -t
sshd -t

echo "== reload services =="
systemctl reload nginx
systemctl reload ssh || systemctl reload sshd

echo "== public ports =="
ss -ltupn | grep -E ':(22|80|443|3000)\\b' || true

echo "== project audit after root hardening =="
sudo -u gemini bash -lc "cd '$APP_DIR' && npm run validate:security-ops-surface || true"

echo "END ROOT SECURITY OPS HARDENING $STAMP"
