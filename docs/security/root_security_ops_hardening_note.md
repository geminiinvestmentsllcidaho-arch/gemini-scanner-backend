# Root-required security ops hardening

Run manually on the VPS when ready:

```bash
cd /home/gemini/apps/gemini-scanner-backend
sudo bash scripts/root_security_ops_hardening.sh
```

This script backs up Nginx and SSH config under `/root/gemini-scanner-security-backups`, disables the default Nginx site, protects `/ops/`, `/runlog`, and `/operator` with existing basic auth, sets `X11Forwarding no`, validates configs, reloads services, and reruns the security ops surface audit.

OS package upgrades and reboot remain a separate maintenance task.
