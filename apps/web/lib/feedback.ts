"use client";

/**
 * Short tones + haptic feedback for scanner / counting flows.
 * Audio is gated on a one-time AudioContext; we reuse it because Chrome
 * limits how many fresh contexts you can spin up.
 */

let _ctx: AudioContext | null = null;
let _enabled = true;

export function setFeedbackEnabled(enabled: boolean) {
  _enabled = enabled;
}

function ctx(): AudioContext | null {
  if (typeof window === "undefined" || !_enabled) return null;
  try {
    if (!_ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      _ctx = new Ctor();
    }
    return _ctx;
  } catch {
    return null;
  }
}

function beep(frequency: number, duration: number, type: OscillatorType = "sine") {
  const ac = ctx();
  if (!ac) return;
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
