"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/shared";
import { WEBHOOK_EVENTS } from "@/lib/actions";

interface Endpoint {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  description: string;
  scope: "read" | "write" | "admin";
}

const ENDPOINTS: Endpoint[] = [
  { method: "GET", path: "/api/v1/products", description: "Ürünleri listele (filtre + sayfalama)", scope: "read" },
  { method: "GET", path: "/api/v1/products/:id", description: "Tek ürün detayı", scope: "read" },
];

const METHOD_COLORS: Record<Endpoint["method"], string> = {
  GET: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  POST: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  PATCH: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  DELETE: "bg-rose-500/15 text-rose-600 border-rose-500/30",
};

export default function ApiDocsPage() {
  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <PageHeader
        title="API Dokümanı"
        description="Public REST API + webhook olayları + Zapier/n8n entegrasyon notları"
        breadcrumb={[
          { label: "Ayarlar", href: "/dashboard/settings" },
          { label: "API Dokümanı" },
        ]}
      />

      {/* Auth */}
      <Card>
        <CardContent className="p-6 space-y-3">
          <h2 className="font-semibold">Kimlik Doğrulama</h2>
          <p className="text-sm text-muted-foreground">
            Her isteğe <code className="bg-muted px-1 py-0.5 rounded font-mono text-xs">Authorization: Bearer sk_live_…</code> başlığını ekleyin.
            Anahtarları{" "}
            <a className="text-primary hover:underline" href="/dashboard/settings/api-keys">
              API Anahtarları
            </a>{" "}
            sayfasından oluşturun.
          </p>
          <pre className="text-xs bg-muted p-3 rounded font-mono overflow-x-auto">
{`curl https://<domain>/api/v1/products \\
  -H "Authorization: Bearer sk_live_<your_token>"`}
          </pre>
        </CardContent>
      </Card>

      {/* Endpoints */}
      <Card>
        <CardContent className="p-6 space-y-3">
          <h2 className="font-semibold">Endpointler</h2>
          <div className="space-y-2">
            {ENDPOINTS.map((e) => (
              <div
                key={`${e.method} ${e.path}`}
                className="rounded-md border border-border bg-card p-3 flex items-start gap-3"
              >
                <Badge variant="outline" className={`font-mono text-[10px] ${METHOD_COLORS[e.method]}`}>
                  {e.method}
                </Badge>
                <div className="flex-1 min-w-0">
                  <code className="text-sm font-mono">{e.path}</code>
                  <p className="text-xs text-muted-foreground mt-0.5">{e.description}</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  scope: {e.scope}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Webhooks */}
      <Card>
        <CardContent className="p-6 space-y-3">
          <h2 className="font-semibold">Webhook Olayları</h2>
          <p className="text-sm text-muted-foreground">
            Aşağıdaki olaylar gerçekleştiğinde sizin URL'inize POST atılır. Her POST{" "}
            <code className="bg-muted px-1 py-0.5 rounded font-mono text-xs">X-StokTakip-Signature</code> ile HMAC-SHA256 imzalanır.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {WEBHOOK_EVENTS.map((e) => (
              <Badge key={e} variant="outline" className="font-mono text-[10px]">
                {e}
              </Badge>
            ))}
          </div>
          <h3 className="text-sm font-semibold mt-4">Payload Şekli</h3>
          <pre className="text-xs bg-muted p-3 rounded font-mono overflow-x-auto">
{`POST <your_url>
Content-Type: application/json
X-StokTakip-Signature: t=1234567890123,v1=abc...
X-StokTakip-Event: stock.low
X-StokTakip-Delivery: <uuid>

{
  "event": "stock.low",
  "deliveryId": "<uuid>",
  "occurredAt": "2026-05-15T10:00:00.000Z",
  "data": {
    "productId": "...",
    "sku": "...",
    "currentStock": 5,
    "minStock": 20
  }
}`}
          </pre>
          <h3 className="text-sm font-semibold mt-4">Doğrulama</h3>
          <pre className="text-xs bg-muted p-3 rounded font-mono overflow-x-auto">
{`// pseudocode
const [, t, v1] = header.match(/t=(\\d+),v1=(.+)/);
if (Math.abs(Date.now() - t) > 5 * 60 * 1000) reject("stale");
const expected = HMAC_SHA256(secret, \`\${t}.\${rawBody}\`);
if (!timingSafeEqual(expected, v1)) reject("invalid");`}
          </pre>
        </CardContent>
      </Card>

      {/* Zapier / n8n */}
      <Card>
        <CardContent className="p-6 space-y-3">
          <h2 className="font-semibold">Zapier & n8n</h2>
          <p className="text-sm text-muted-foreground">
            REST API ve webhook altyapısı standart şekilde çalıştığı için Zapier'in <strong>Webhooks by Zapier</strong>{" "}
            veya n8n'in <strong>HTTP Request</strong> + <strong>Webhook</strong> node'larını kullanarak entegrasyon kurabilirsiniz.
          </p>
          <ul className="text-sm space-y-1.5 list-disc list-inside text-muted-foreground">
            <li>
              <strong>Trigger</strong>: Webhook URL'inizi Zapier/n8n'ten alın, StokTakip Webhooks sayfasında bir hook olarak ekleyin.
            </li>
            <li>
              <strong>Action</strong>: Zapier'in HTTP modülü ile <code className="bg-muted px-1 py-0.5 rounded font-mono text-xs">/api/v1/*</code> endpointlerini Bearer token ile çağırın.
            </li>
            <li>
              <strong>HMAC doğrulama</strong>: Zapier <code className="font-mono text-xs">Catch Hook</code> raw body'yi sunar; n8n'in Webhook node'unda <code className="font-mono text-xs">Raw Body</code> seçeneğini açın.
            </li>
          </ul>
          <a
            href="https://zapier.com/help/doc/how-get-started-webhooks-zapier"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            Zapier Webhook Dokümanı
            <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
