import { NextResponse } from "next/server";
import { log } from "@/lib/log";

const MAX_BODY = 16 * 1024; // 16KB cap — protect against runaway stacks

interface ReportBody {
  message?: string;
  digest?: string;
  stack?: string;
  url?: string;
  userAgent?: string;
  fatal?: boolean;
}

export async function POST(req: Request) {
  let body: ReportBody = {};
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) {
      return NextResponse.json({ ok: false, error: "payload_too_large" }, { status: 413 });
    }
    body = JSON.parse(text) as ReportBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  log.error(body.message || "client error report", {
    digest: body.digest,
    stack: body.stack,
    url: body.url,
    userAgent: body.userAgent,
    fatal: body.fatal === true,
    source: "client",
  });

  return NextResponse.json({ ok: true });
}
