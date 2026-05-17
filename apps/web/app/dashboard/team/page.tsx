"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Plus,
  Shield,
  Mail,
  Loader2,
  Trash2,
  Copy,
  Power,
  PowerOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/shared";
import {
  listTeamMembers,
  updateTeamMember,
  listInvitations,
  createInvitation,
  revokeInvitation,
  getWarehouses,
  getPlanLimits,
  type TeamMember,
  type Invitation,
  type PlanLimits,
} from "@/lib/actions";
import type { UserRole, Warehouse } from "@/lib/types";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  manager: "Müdür",
  warehouse_staff: "Depo Personeli",
  viewer: "Görüntüleyici",
};

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [limits, setLimits] = useState<PlanLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: "",
    role: "warehouse_staff" as UserRole,
    warehouseIds: new Set<string>(),
  });
  const [submitting, setSubmitting] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    Promise.all([listTeamMembers(), listInvitations(), getWarehouses(), getPlanLimits()]).then(
      ([m, i, w, l]) => {
        if (m.ok) setMembers(m.data);
        if (i.ok) setInvitations(i.data.filter((inv) => !inv.acceptedAt));
        if (w.ok) setWarehouses(w.data);
        if (l.ok) setLimits(l.data);
        setLoading(false);
      }
    );
  };

  useEffect(refresh, []);

  const submitInvite = async () => {
    if (!inviteForm.email) {
      toast.error("E-posta zorunlu");
      return;
    }
    setSubmitting(true);
    const r = await createInvitation({
      email: inviteForm.email,
      role: inviteForm.role,
      warehouseIds: inviteForm.warehouseIds.size > 0 ? Array.from(inviteForm.warehouseIds) : undefined,
    });
    setSubmitting(false);
    if (!r.ok) {
      toast.error(r.error.message);
      return;
    }
    setGeneratedToken(r.data.token);
    toast.success("Davet oluşturuldu");
    refresh();
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/accept-invite?token=${token}`;
    navigator.clipboard.writeText(url).then(() => toast.success("Davet linki kopyalandı"));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Ekip"
        description={`${members.length} üye${invitations.length > 0 ? ` · ${invitations.length} bekleyen davet` : ""}`}
        actions={
          <Button
            onClick={() => {
              setInviteForm({ email: "", role: "warehouse_staff", warehouseIds: new Set() });
              setGeneratedToken(null);
              setShowInvite(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Üye Davet Et
          </Button>
        }
      />

      {limits && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Kullanıcılar</p>
              <p className="text-xl font-bold tabular-nums mt-1">
                {limits.currentUsers}
                {limits.maxUsers !== null && (
                  <span className="text-sm font-normal text-muted-foreground"> / {limits.maxUsers}</span>
                )}
              </p>
              {limits.maxUsers !== null && (
                <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${Math.min(100, (limits.currentUsers / limits.maxUsers) * 100)}%` }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Ürünler</p>
              <p className="text-xl font-bold tabular-nums mt-1">
                {limits.currentProducts}
                {limits.maxProducts !== null && (
                  <span className="text-sm font-normal text-muted-foreground"> / {limits.maxProducts}</span>
                )}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Depolar</p>
              <p className="text-xl font-bold tabular-nums mt-1">
                {limits.currentWarehouses}
                {limits.maxWarehouses !== null && (
                  <span className="text-sm font-normal text-muted-foreground"> / {limits.maxWarehouses}</span>
                )}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Members */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded bg-muted/50 animate-pulse" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <EmptyState icon={Users} title="Henüz üye yok" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>İsim</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Depo Erişimi</TableHead>
                  <TableHead className="text-center">Durum</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id} className={m.isActive ? "" : "opacity-60"}>
                    <TableCell className="font-medium">{m.fullName}</TableCell>
                    <TableCell>
                      <Select
                        value={m.role}
                        onValueChange={async (v) => {
                          if (!v) return;
                          const r = await updateTeamMember({ userId: m.id, role: v as UserRole });
                          if (r.ok) {
                            toast.success("Rol güncellendi");
                            refresh();
                          } else toast.error(r.error.message);
                        }}
                      >
                        <SelectTrigger className="h-7 w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.warehouseIds.length === 0
                        ? "Tüm depolar"
                        : m.warehouseIds
                            .map((id) => warehouses.find((w) => w.id === id)?.name)
                            .filter(Boolean)
                            .join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {m.isActive ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px]">
                          Aktif
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Pasif</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title={m.isActive ? "Devre dışı bırak" : "Etkinleştir"}
                        onClick={async () => {
                          const r = await updateTeamMember({ userId: m.id, isActive: !m.isActive });
                          if (r.ok) refresh();
                          else toast.error(r.error.message);
                        }}
                      >
                        {m.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4 text-emerald-500" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2 text-sm font-medium">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Bekleyen Davetler ({invitations.length})
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-posta</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Süre</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-sm">{inv.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {ROLE_LABELS[inv.role]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(inv.expiresAt).toLocaleDateString("tr-TR")}'a kadar
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyInviteLink(inv.token)}
                      >
                        <Copy className="mr-1 h-3.5 w-3.5" />
                        Link
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={async () => {
                          const r = await revokeInvitation(inv.id);
                          if (r.ok) {
                            toast.success("Davet iptal edildi");
                            refresh();
                          } else toast.error(r.error.message);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Invite dialog */}
      <Dialog open={showInvite} onOpenChange={(o) => { setShowInvite(o); if (!o) setGeneratedToken(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Üye Daveti</DialogTitle>
            <DialogDescription>
              Davet linki oluşturulur; e-postayla göndermek için kopyalayın.
            </DialogDescription>
          </DialogHeader>
          {generatedToken ? (
            <div className="space-y-3 py-2">
              <Label>Davet linki</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/accept-invite?token=${generatedToken}`}
                  className="font-mono text-xs"
                />
                <Button onClick={() => copyInviteLink(generatedToken)}>
                  <Copy className="mr-1 h-3.5 w-3.5" />
                  Kopyala
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Bu link 7 gün geçerli. Davet edilen kişi linke tıklayıp giriş yaptığında otomatik şirketinize katılır.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 py-2">
              <div className="grid gap-2">
                <Label>E-posta *</Label>
                <Input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="ornek@firma.com"
                />
              </div>
              <div className="grid gap-2">
                <Label>Rol</Label>
                <Select
                  value={inviteForm.role}
                  onValueChange={(v) => v && setInviteForm({ ...inviteForm, role: v as UserRole })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(inviteForm.role === "warehouse_staff" || inviteForm.role === "viewer") && warehouses.length > 0 && (
                <div className="grid gap-2">
                  <Label className="flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    Depo Erişimi (boş = hepsi)
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {warehouses.map((w) => {
                      const active = inviteForm.warehouseIds.has(w.id);
                      return (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => {
                            const next = new Set(inviteForm.warehouseIds);
                            if (next.has(w.id)) next.delete(w.id);
                            else next.add(w.id);
                            setInviteForm({ ...inviteForm, warehouseIds: next });
                          }}
                          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                            active
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/50"
                          }`}
                        >
                          {w.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {generatedToken ? (
              <Button onClick={() => setShowInvite(false)}>Kapat</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowInvite(false)}>İptal</Button>
                <Button onClick={submitInvite} disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Davet Oluştur
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
