function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function buildScannerCandidate(run = {}) {
  const symbol =
    run?.result?.symbol ||
    run?.symbol ||
    null;

  const context = run?.context_v3 || {};
  const integrity = context?.integrity || {};
  const quality = integrity?.quality || {};

  return {
    symbol,

    p3GateOk: run?.p3_gate?.ok === true,

    confidence: clamp01(
      Number(quality?.confidence)
    ),

    structuralQuality: clamp01(
      Number(quality?.structuralQuality)
    ),

    compositeConfidence: clamp01(
      Number(quality?.compositeConfidence)
    ),

    qualityOverall: clamp01(
      Number(context?.quality?.overall)
    ),

    rsi: Number.isFinite(Number(run?.coaching?.rsi))
      ? Number(run.coaching.rsi)
      : null,
  };
}
