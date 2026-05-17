"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getUnreadCount } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";

/**
 * Live unread-count badge. Initial value comes from a server action; subsequent
 * updates arrive over Supabase Realtime on the `notifications` table. Fades
 * back to a poll-every-60s fallback when realtime isn't available (demo mode).
 */
export function NotificationsBell() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    let interval: ReturnType<typeof setInterval> | null = null;

    const refresh = async () => {
      const result = await getUnreadCount();
      if (mounted && result.ok) setCount(result.data);
    };
    void refresh();

    // Realtime: subscribe to inserts/updates on notifications for this user.
    // The client-side subscription respects RLS, so this only sees rows where
    // user_id = auth.uid().
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
    try {
      const supabase = createClient();
      channel = supabase
        .channel("notifications-bell")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications" },
          () => {
            void refresh();
          }
        )
        .subscribe();
    } catch {
      // Realtime unavailable (e.g. demo) — fall back to polling.
      interval = setInterval(refresh, 60_000);
    }

    return () => {
      mounted = false;
      if (channel) channel.unsubscribe();
      if (interval) clearInterval(interval);
    };
  }, []);

  return (
    <Button variant="ghost" size="icon" className="h-9 w-9 relative" asChild>
      <Link href="/dashboard/notifications" id="notifications-btn" aria-label="Bildirimler">
        <Bell className="h-4 w-4" />
        {count !== null && count > 0 && (
          <Badge className="absolute -top-0.5 -right-0.5 h-4 w-4 p-0 flex items-center justify-center text-[9px] font-bold animate-pulse-glow">
            {count > 9 ? "9+" : count}
          </Badge>
        )}
      </Link>
    </Button>
  );
}
