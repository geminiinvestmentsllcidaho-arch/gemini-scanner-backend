(() => {
  const root = document.querySelector("[data-stage1-exit-alert]");
  if (!root) return;

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

  const key = root.dataset.alertKey || "stage1-exit";
  const firedKey = `gs.stage1.exit.fired.${key}`;
  const ackKey = `gs.stage1.exit.ack.${key}`;
  const status = root.querySelector("[data-stage1-alert-status]");
  const enable = root.querySelector("[data-enable-stage1-exit-alerts]");
  const ack = root.querySelector("[data-ack-stage1-exit-alert]");
  const setStatus = (text) => { if (status) status.textContent = text; };

  if (localStorage.getItem(ackKey) === "1") {
    root.dataset.acknowledged = "true";
    setStatus("EXIT alert acknowledged on this device.");
  } else {
    document.title = document.title.startsWith("EXIT ALERT") ? document.title : `EXIT ALERT · ${document.title}`;
    navigator.vibrate?.([250, 120, 250, 120, 500]);
    root.dataset.visualActive = "true";
  }

  enable?.addEventListener("click", async (event) => {
    try {
      const played = await playGeminiScannerExitChime();
      if ("Notification" in window) {
        const permission = Notification.permission === "default"
          ? await Notification.requestPermission()
          : Notification.permission;
        if (permission === "granted" && localStorage.getItem(firedKey) !== "1") {
          new Notification("GeminiScanner Stage 1 EXIT review", {
            body: "Manually review and close the one-share Alpaca paper position.",
            requireInteraction: true,
          });
          localStorage.setItem(firedKey, "1");
        }
      }
      event.currentTarget.textContent = played
        ? "Custom EXIT chime and notifications enabled"
        : "EXIT notifications enabled; sound unsupported";
      event.currentTarget.disabled = true;
      setStatus(played
        ? "Visual, vibration, custom EXIT chime, and permitted browser notification are active."
        : "Visual, vibration, and permitted browser notification are active; browser audio is unsupported.");
    } catch {
      event.currentTarget.textContent = "Visual EXIT alert remains active";
      setStatus("Browser blocked sound or notifications; visual alert remains active.");
    }
  }, { once: true });

  ack?.addEventListener("click", () => {
    localStorage.setItem(ackKey, "1");
    root.dataset.acknowledged = "true";
    document.title = document.title.replace(/^EXIT ALERT · /, "");
    setStatus("EXIT alert acknowledged on this device. Manual Alpaca action is still required.");
    ack.disabled = true;
  });
})();
