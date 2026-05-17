"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useChord, useHotkey } from "@/hooks/use-hotkey";
import { NAV_CHORDS } from "@/lib/hotkeys";
import { HotkeysHelp } from "./hotkeys-help";

const SEARCH_INPUT_ID = "global-search";

/**
 * Mounts the global hotkey listeners + the "?" help dialog.
 * Place inside the dashboard layout (one instance per logged-in session).
 */
export function GlobalHotkeys() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);

  // "/" → focus the global search input
  useHotkey("/", (e) => {
    const el = document.getElementById(SEARCH_INPUT_ID) as HTMLInputElement | null;
    if (el) {
      e.preventDefault();
      el.focus();
      el.select();
    }
  });

  // "?" (shift+/) → open shortcuts help
  useHotkey("shift+?", (e) => {
    e.preventDefault();
    setHelpOpen(true);
  });

  // Chord "g <letter>" → jump to that section.
  useChord("g", (follower) => {
    const target = NAV_CHORDS[follower];
    if (target) router.push(target);
  });

  return <HotkeysHelp open={helpOpen} onOpenChange={setHelpOpen} />;
}
