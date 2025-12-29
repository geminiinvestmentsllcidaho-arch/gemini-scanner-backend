export function getDiagnostics() {
  return {
    service: 'GeminiScanner',
    status: 'ok',
    uptimeSec: process.uptime(),
    memory: process.memoryUsage(),
    ts: new Date().toISOString()
  };
}
