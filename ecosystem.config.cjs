module.exports = {
  apps: [
    {
      name: "gemini-scanner",
      cwd: "/home/gemini/apps/gemini-scanner-backend",
      script: "./src/server.js",
      interpreter: "/usr/bin/node",
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "gemini-paper-manual-watcher",
      cwd: "/home/gemini/apps/gemini-scanner-backend",
      script: "./scripts/watch_paper_manual_round_trip_evidence.mjs",
      interpreter: "/usr/bin/node",
      exec_mode: "fork",
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 20,
      env: {
        NODE_ENV: "production",
        PAPER_MANUAL_WATCH_INTERVAL_MS: "15000",
      },
    },
  ],
};
