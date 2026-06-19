"use client";

/**
 * Short tones + haptic feedback for scanner / counting flows.
 *
 * Mobile browsers (and desktop Chrome's autoplay policy) start every
 * AudioContext in a "suspended" state until the user interacts with the page.
 * A barcode read fired by the camera is NOT a user gesture, so the beep was
 * being silently dropped. We lazily create one shared context (Chrome limits
 * how many fresh contexts you can spin up) and resume it on the first real
 * user gesture — after which every later scan/sale beep plays.
 */

let _ctx: AudioContext | null = null;
let _enabled = true;
let _unlockBound = false;

function ctxRaw(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!_ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      _ctx = new Ctor();
    }
    return _ctx;
  } catch {
    return null;
  }
}

/** Bind one-time gesture listeners that resume the (suspended) audio context. */
function ensureUnlockListeners() {
  if (_unlockBound || typeof window === "undefined") return;
  _unlockBound = true;
  const resume = () => {
    const ac = ctxRaw();
    if (ac && ac.state === "suspended") ac.resume().catch(() => {});
  };
  // Capture phase + kept alive (not { once }) so we also recover after the
  // app is backgrounded and the context gets re-suspended by the OS.
  ["pointerdown", "touchend", "mousedown", "keydown"].forEach((evt) =>
    window.addEventListener(evt, resume, { passive: true, capture: true })
  );
}

export function setFeedbackEnabled(enabled: boolean) {
  _enabled = enabled;
  if (enabled) ensureUnlockListeners();
}

/**
 * Create + resume the audio context from inside a user gesture (e.g. the tap
 * that opens the camera). Safe to call repeatedly; cheap no-op once running.
 */
export function unlockAudio() {
  ensureUnlockListeners();
  const ac = ctxRaw();
  if (ac && ac.state === "suspended") ac.resume().catch(() => {});
}

function beep(frequency: number, duration: number, type: OscillatorType = "sine") {
  if (!_enabled) return;
  const ac = ctxRaw();
  if (!ac) return;
  // A scan callback isn't a gesture; nudge the context in case it slipped back
  // to "suspended" (the unlock listeners normally keep it running).
  if (ac.state === "suspended") ac.resume().catch(() => {});
  try {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.value = 0.18;
    osc.connect(gain).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + duration / 1000);
  } catch {
    /* swallow — audio unavailable */
  }
}

function vibrate(pattern: number | number[]) {
  if (typeof navigator === "undefined" || !_enabled) return;
  navigator.vibrate?.(pattern);
}

export const feedback = {
  /** Scan / count succeeded. Short high beep + 50ms vibration. */
  ok: () => {
    beep(880, 90);
    vibrate(50);
  },
  /** Duplicate or non-critical warning. Mid pitch + double tap. */
  warn: () => {
    beep(520, 140);
    vibrate([50, 60, 50]);
  },
  /** Hard failure. Low long beep + long vibration. */
  error: () => {
    beep(220, 260, "sawtooth");
    vibrate(280);
  },
};
