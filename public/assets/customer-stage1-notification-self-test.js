(() => {
  if (typeof document === "undefined") return;
  const root = document.querySelector("[data-stage1-notification-self-test]");
  if (!root) return;
  const button = root.querySelector("[data-run-stage1-notification-self-test]");
  const status = root.querySelector("[data-stage1-notification-self-test-status]");
  const setStatus = (text) => { if (status) status.textContent = text; };
  button?.addEventListener("click", async () => {
    const results = [];
    try {
      navigator.vibrate?.([120, 80, 120]);
      results.push("vibration requested");
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (Audio) {
        const context = new Audio();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = 740;
        gain.gain.value = 0.06;
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.3);
        results.push("sound played");
      } else {
        results.push("sound unsupported");
      }
      if ("Notification" in window) {
        const permission = Notification.permission === "default"
          ? await Notification.requestPermission()
          : Notification.permission;
        if (permission === "granted") {
          new Notification("GeminiScanner notification self-test", {
            body: "Browser alerts are available. This is not an EXIT signal.",
            requireInteraction: false,
          });
          results.push("notification shown");
        } else {
          results.push(`notification ${permission}`);
        }
      } else {
        results.push("notification unsupported");
      }
      root.dataset.selfTestResult = "complete";
      setStatus(`Self-test complete: ${results.join("; ")}.`);
    } catch {
      root.dataset.selfTestResult = "partial";
      setStatus("Self-test partially blocked by this browser. Stage 1 evidence was not changed.");
    }
  });
})();
