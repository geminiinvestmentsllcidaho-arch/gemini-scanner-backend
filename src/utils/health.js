// src/utils/health.js
export function health(req, res) {
  res.json({ status: 'ok' });
}

export function readiness(req, res) {
  res.json({ ready: true });
}
