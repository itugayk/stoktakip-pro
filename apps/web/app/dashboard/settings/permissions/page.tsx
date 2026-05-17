"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X, Shield } from "lucide-react";
import { PageHeader } from "@/components/shared";
import type { UserRole } from "@/lib/types";

// Permission matrix — read-only. Editing is gated on Postgres RLS, not UI;
// this surface lets admins audit what each role can do.
const ROLES: UserRole[] = ["admin", "manager", "warehouse_staff", "viewer"];
const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  manager: "Müdür",
  warehouse_staff: "Depo Personeli",
  viewer: "Görüntüleyici",
};

type Verb = "read" | "create" | "update" | "delete" | "approve";

interface Capability {
  resource: string;
  perms: Record<UserRole, Record<Verb, boolean>>;
}

// Mirrors the RLS + withRole rules that already exist in the codebase.
const MATRIX: Capability[] = [
  {
    resource: "Ürünler",
    perms: {
      admin:           { read: true, create: true,  update: true,  delete: true,  approve: false },
      manager:         { read: true, create: true,  update: true,  delete: true,  approve: false },
      warehouse_staff: { read: true, create: false, update: false, delete: false, approve: false },
      viewer:          { read: true, create: false, update: false, delete: false, approve: false },
    },
  },
  {
    resource: "Stok Hareketleri",
    perms: {
      admin:           { read: true, create: true,  update: true,  delete: true,  approve: true  },
      manager:         { read: true, create: true,  update: true,  delete: false, approve: true  },
      warehouse_staff: { read: true, create: true,  update: false, delete: false, approve: false },
      viewer:          { read: true, create: false, update: false, delete: false, approve: false },
    },
  },
  {
    resource: "Satın Alma Siparişleri",
    perms: {
      admin:           { read: true, create: true,  update: true,  delete: true,  approve: true  },
      manager:         { read: true, create: true,  update: true,  delete: false, approve: true  },
      warehouse_staff: { read: true, create: false, update: false, delete: false, approve: false },
      viewer:          { read: true, create: false, update: false, delete: false, approve: false },
    },
  },
  {
    resource: "Satış Siparişleri",
    perms: {
      admin:           { read: true, create: true,  update: true,  delete: true,  approve: true  },
      manager:         { read: true, create: true,  update: true,  delete: false, approve: true  },
      warehouse_staff: { read: true, create: true,  update: true,  delete: false, approve: false },
      viewer:          { read: true, create: false, update: false, delete: false, approve: false },
    },
  },
  {
    resource: "İadeler",
    perms: {
      admin:           { read: true, create: true,  update: true,  delete: true,  approve: true  },
      manager:         { read: true, create: true,  update: true,  delete: false, approve: true  },
      warehouse_staff: { read: true, create: true,  update: false, delete: false, approve: false },
      viewer:          { read: true, create: false, update: false, delete: false, approve: false },
    },
  },
  {
    resource: "Sayımlar",
    perms: {
      admin:           { read: true, create: true,  update: true,  delete: true,  approve: true  },
      manager:         { read: true, create: true,  update: true,  delete: false, approve: true  },
      warehouse_staff: { read: true, create: true,  update: true,  delete: false, approve: false },
      viewer:          { read: true, create: false, update: false, delete: false, approve: false },
    },
  },
  {
    resource: "Ekip & Davet",
    perms: {
      admin:           { read: true, create: true,  update: true,  delete: true,  approve: false },
      manager:         { read: true, create: false, update: false, delete: false, approve: false },
      warehouse_staff: { read: false, create: false, update: false, delete: false, approve: false },
      viewer:          { read: false, create: false, update: false, delete: false, approve: false },
    },
  },
  {
    resource: "Ayarlar (kurallar, planlar)",
    perms: {
      admin:           { read: true, create: true,  update: true,  delete: true,  approve: false },
      manager:         { read: true, create: false, update: false, delete: false, approve: false },
      warehouse_staff: { read: false, create: false, update: false, delete: false, approve: false },
      viewer:          { read: false, create: false, update: false, delete: false, approve: false },
    },
  },
];

const VERBS: { key: Verb; label: string }[] = [
  { key: "read", label: "Görüntüle" },
  { key: "create", label: "Oluştur" },
  { key: "update", label: "Düzenle" },
  { key: "delete", label: "Sil" },
  { key: "approve", label: "Onayla" },
];

function Indicator({ allowed }: { allowed: boolean }) {
  return allowed ? (
    <Check className="h-4 w-4 mx-auto text-emerald-500" />
  ) : (
    <X className="h-4 w-4 mx-auto text-muted-foreground/40" />
  );
}

export default function PermissionsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Yetki Matrisi"
        description="Rollerin hangi işlemleri yapabildiğini gösterir"
        breadcrumb={[
          { label: "Ayarlar", href: "/dashboard/settings" },
          { label: "Yetkiler" },
        ]}
      />

      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground flex items-start gap-2">
          <Shield className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            Yetkiler veritabanı (RLS) seviyesinde uygulanır. Bu sayfa salt okunurdur —
            bireysel kullanıcı rolünü değiştirmek için <strong>Ekip</strong> sayfasını kullanın.
          </p>
        </CardContent>
      </Card>

      {ROLES.map((role) => (
        <Card key={role}>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{ROLE_LABELS[role]}</Badge>
              <span className="text-xs text-muted-foreground font-mono">{role}</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kaynak</TableHead>
                  {VERBS.map((v) => (
                    <TableHead key={v.key} className="text-center">{v.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {MATRIX.map((cap) => (
                  <TableRow key={cap.resource}>
                    <TableCell className="font-medium">{cap.resource}</TableCell>
                    {VERBS.map((v) => (
                      <TableCell key={v.key}>
                        <Indicator allowed={cap.perms[role][v.key]} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
