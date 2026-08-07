(() => {
  if (typeof document === "undefined") return;

  const playGeminiScannerExitChime = async () => {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return false;
    const context = new Audio();
    await context.resume?.();
    const notes = [
      { frequency: 659.25, start: 0.00, duration: 0.20, gain: 0.070 },
      { frequency: 783.99, start: 0.24, duration: 0.20, gain: 0.074 },
      { frequency: 987.77, start: 0.48, duration: 0.24, gain: 0.078 },
      { frequency: 783.99, start: 0.78, duration: 0.22, gain: 0.072 },
      { frequency: 523.25, start: 1.06, duration: 0.42, gain: 0.082 },
    ];
    for (const note of notes) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = note.frequency;
      oscillator.connect(gain);
      gain.connect(context.destination);
      const startAt = context.currentTime + note.start;
      const stopAt = startAt + note.duration;
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(note.gain, startAt + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
      oscillator.start(startAt);
      oscillator.stop(stopAt + 0.02);
    }
    window.setTimeout(() => context.close?.(), 1800);
    return true;
  };

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
        const played = await playGeminiScannerExitChime();
        results.push(played ? "custom EXIT chime played" : "sound unsupported");
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
