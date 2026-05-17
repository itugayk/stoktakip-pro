import { Suspense } from "react";
import { AcceptInviteClient } from "./client";

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-muted-foreground">Yükleniyor…</p>
        </div>
      }
    >
      <AcceptInviteClient />
    </Suspense>
  );
}
