"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getUnreadCount } from "@/lib/actions";

/**
 * Live unread-count badge. Polls the server every 60s. Supabase Realtime is
 * gone; if instant updates become important later, plug in Postgres LISTEN/SSE.
 */
export function NotificationsBell() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      const result = await getUnreadCount();
      if (mounted && result.ok) setCount(result.data);
    };
    void refresh();
    const interval = setInterval(refresh, 60_000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <Button variant="ghost" size="icon" className="h-9 w-9 relative" asChild>
      <Link
        href="/dashboard/notifications"
        id="notifications-btn"
        aria-label="Bildirimler"
      >
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
