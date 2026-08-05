(() => {
  const root = document.querySelector("[data-gs-market-countdown]");
  if (!root) return;
  const label = root.querySelector("[data-gs-market-countdown-label]");
  const value = root.querySelector("[data-gs-market-countdown-value]");
  const targetMs = Date.parse(root.dataset.target || "");
  const mode = root.dataset.mode === "close" ? "close" : "open";
  let reloading = false;
  const format = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const clock = [hours, minutes, secs].map((part) => String(part).padStart(2, "0")).join(":");
    return days > 0 ? `${days}d ${clock}` : clock;
  };
  const tick = () => {
    if (!Number.isFinite(targetMs)) {
      if (label) label.textContent = "Market schedule";
      if (value) value.textContent = "Unavailable";
      return;
    }
    const remaining = Math.max(0, Math.ceil((targetMs - Date.now()) / 1000));
    if (label) label.textContent = mode === "close" ? "Market closes in" : "Market opens in";
    if (value) value.textContent = format(remaining);
    if (remaining === 0 && !reloading) {
      reloading = true;
      window.setTimeout(() => window.location.reload(), 1100);
    }
  };
  tick();
  window.setInterval(tick, 1000);
})();
