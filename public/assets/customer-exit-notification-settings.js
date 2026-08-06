(() => {
  if (typeof document === "undefined") return;
  const root = document.querySelector("[data-exit-notification-settings]");
  if (!root) return;
  const button = root.querySelector("[data-test-exit-notification]");
  const status = root.querySelector("[data-exit-notification-test-status]");
  const website = root.querySelector('input[name="exitWebsiteEnabled"]');
  const sound = root.querySelector('input[name="exitSoundEnabled"]');
  const setStatus = (text) => { if (status) status.textContent = text; };
  button?.addEventListener("click", async () => {
    const results = [];
    try {
      if (sound?.checked) {
        navigator.vibrate?.([180, 90, 180, 90, 360]);
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (Audio) {
          const context = new Audio();
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.frequency.value = 880;
          gain.gain.value = 0.07;
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start();
          oscillator.stop(context.currentTime + 0.4);
          results.push("sound played");
        } else results.push("sound unsupported");
      } else results.push("sound disabled");
      if (website?.checked && "Notification" in window) {
        const permission = Notification.permission === "default"
          ? await Notification.requestPermission()
          : Notification.permission;
        if (permission === "granted") {
          new Notification("GeminiScanner EXIT notification test", {
            body: "TEST ONLY · Symbol TEST · Quantity 1 · EXIT reason: notification verification. No trading action occurred.",
            requireInteraction: false,
          });
          results.push("website notification shown");
        } else results.push(`website notification ${permission}`);
      } else if (!website?.checked) results.push("website notification disabled");
      else results.push("website notification unsupported");
      root.dataset.exitNotificationTest = "complete";
      setStatus(`EXIT notification test complete: ${results.join("; ")}. No EXIT signal, broker contact, order, position change, or evidence change occurred.`);
    } catch {
      root.dataset.exitNotificationTest = "partial";
      setStatus("The browser partially blocked the EXIT notification test. No trading action or evidence change occurred.");
    }
  });
})();
