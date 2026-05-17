"use client";

import { useEffect, useRef } from "react";

/**
 * Bind a single keystroke. The handler runs unless focus is inside an editable
 * element (input/textarea/contenteditable) — except for the "/" key, which
 * specifically focuses the global search.
 *
 * Combo syntax:
 *   "k"         → just "k"
 *   "mod+k"     → Cmd on Mac / Ctrl elsewhere + k
 *   "ctrl+k"    → literally Ctrl
 *   "shift+?"   → Shift + ?
 *   "/"         → just "/"
 */
export function useHotkey(
  combo: string,
  handler: (e: KeyboardEvent) => void,
  options?: { allowInInputs?: boolean; enabled?: boolean }
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (options?.enabled === false) return;

    const parts = combo.toLowerCase().split("+").map((p) => p.trim());
    const key = parts[parts.length - 1];
    const needMod = parts.includes("mod");
    const needCtrl = parts.includes("ctrl");
    const needShift = parts.includes("shift");
    const needAlt = parts.includes("alt");

    function onKey(e: KeyboardEvent) {
      if (!options?.allowInInputs && isEditableTarget(e.target)) return;
      if (e.key.toLowerCase() !== key) return;

      const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
      const modPressed = isMac ? e.metaKey : e.ctrlKey;
      if (needMod && !modPressed) return;
      if (needCtrl && !e.ctrlKey) return;
      if (needShift !== e.shiftKey) return;
      if (needAlt !== e.altKey) return;

      handlerRef.current(e);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [combo, options?.allowInInputs, options?.enabled]);
}

/**
 * Chord-style hotkey: press the prefix then a follower within `windowMs`.
 * Inspired by Gmail's `g i` style.
 */
export function useChord(
  prefix: string,
  onChord: (followerKey: string, e: KeyboardEvent) => void,
  options?: { windowMs?: number; enabled?: boolean }
) {
  const onChordRef = useRef(onChord);
  onChordRef.current = onChord;

  useEffect(() => {
    if (options?.enabled === false) return;
    const windowMs = options?.windowMs ?? 1200;
    const prefixKey = prefix.toLowerCase();
    let armedUntil = 0;

    function onKey(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const k = e.key.toLowerCase();
      const now = Date.now();

      if (now < armedUntil) {
        armedUntil = 0;
        onChordRef.current(k, e);
        return;
      }

      if (k === prefixKey) {
        armedUntil = now + windowMs;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prefix, options?.windowMs, options?.enabled]);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}
