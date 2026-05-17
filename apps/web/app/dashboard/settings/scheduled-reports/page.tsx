"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, CalendarClock, Loader2, X } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PageHeader, EmptyState, ConfirmDialog } from "@/components/shared";
import {
  listScheduledReports,
  upsertScheduledReport,
  deleteScheduledReport,
  type ScheduledReport,
  type ScheduledReportType,
  type ScheduledFrequency,
} from "@/lib/actions";

const REPORT_LABELS: Record<ScheduledReportType, string> = {
  inventory: "Stok Bakiye",
  expiry: "SKT Yaklaşanlar",
  turnover: "Devir Hızı",
  profit: "Kar/Zarar",
  sales_summary: "Satış Özeti",
};

const FREQUENCY_LABELS: Record<ScheduledFrequency, string> = {
  daily: "Günlük",
  weekly: "Haftalık",
  monthly: "Aylık",
};

const DAYS_OF_WEEK = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

interface FormState {
  id?: string;
  name: string;
  reportType: ScheduledReportType;
  frequency: ScheduledFrequency;
  dayOfPeriod: string;
  hourOfDay: string;
  recipients: string[];
  recipientInput: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  reportType: "inventory",
  frequency: "weekly",
  dayOfPeriod: "1",
  hourOfDay: "8",
  recipients: [],
  recipientInput: "",
  isActive: true,
};

export default function ScheduledReportsPage() {
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    listScheduledReports().then((r) => {
      if (r.ok) setReports(r.data);
      else toast.error(r.error.message);
      setLoading(false);
    });
  };

  useEffect(refresh, []);

  const submit = async () => {
    if (!form.name.trim()) {
      toast.error("Ad zorunlu");
      return;
    }
    if (form.recipients.length === 0) {
      toast.error("En az bir alıcı e-postası ekleyin");
      return;
    }
    const r = await upsertScheduledReport({
      id: form.id,
      name: form.name,
      reportType: form.reportType,
      params: {},
      frequency: form.frequency,
      dayOfPeriod: form.frequency === "daily" ? undefined : Number(form.dayOfPeriod) || undefined,
      hourOfDay: Number(form.hourOfDay) || 8,
      recipients: form.recipients,
      isActive: form.isActive,
    });
    if (!r.ok) {
      toast.error(r.error.message);
      return;
    }
    toast.success(form.id ? "Güncellendi" : "Oluşturuldu");
    setShowDialog(false);
    refresh();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const r = await deleteScheduledReport(deleteId);
    if (r.ok) {
      toast.success("Silindi");
      refresh();
    } else toast.error(r.error.message);
  };

  const addRecipient = () => {
    const v = form.recipientInput.trim();
    if (!v) return;
    if (form.recipients.includes(v)) {
      toast.error("Zaten ekli");
      return;
    }
    setForm({ ...form, recipients: [...form.recipients, v], recipientInput: "" });
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <PageHeader
        title="Zamanlanmış Raporlar"
        description="Periyodik olarak e-posta gönderilecek raporlar"
        breadcrumb={[
          { label: "Ayarlar", href: "/dashboard/settings" },
          { label: "Raporlar" },
        ]}
        actions={
          <Button
            onClick={() => {
              setForm(EMPTY_FORM);
              setShowDialog(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Yeni Zamanlama
          </Button>
        }
      />

      {loading ? (
        <Card>
          <CardContent className="p-6 space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 rounded bg-muted/50 animate-pulse" />
            ))}
          </CardContent>
        </Card>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={CalendarClock}
              title="Henüz zamanlama yok"
              description="Haftalık özet e-postası, günlük SKT raporu gibi otomatik raporlar oluşturun."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <Card key={r.id} className={r.isActive ? "" : "opacity-60"}>
              <CardContent className="p-4 flex items-center gap-4">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    r.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <CalendarClock className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {REPORT_LABELS[r.reportType]} · {FREQUENCY_LABELS[r.frequency]}
                    {r.frequency === "weekly" &&
                      r.dayOfPeriod !== undefined &&
                      ` · ${DAYS_OF_WEEK[r.dayOfPeriod]}`}
                    {r.frequency === "monthly" && r.dayOfPeriod !== undefined && ` · Her ayın ${r.dayOfPeriod}'i`}
                    {` · ${String(r.hourOfDay).padStart(2, "0")}:00`}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {r.recipients.length} alıcı
                    {r.nextRunAt && ` · Sonraki: ${new Date(r.nextRunAt).toLocaleString("tr-TR")}`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setForm({
                      id: r.id,
                      name: r.name,
                      reportType: r.reportType,
                      frequency: r.frequency,
                      dayOfPeriod: String(r.dayOfPeriod ?? 1),
                      hourOfDay: String(r.hourOfDay),
                      recipients: r.recipients,
                      recipientInput: "",
                      isActive: r.isActive,
                    });
                    setShowDialog(true);
                  }}
                >
                  Düzenle
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => setDeleteId(r.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Zamanlamayı Düzenle" : "Yeni Zamanlama"}</DialogTitle>
            <DialogDescription>Hangi rapor, ne sıklıkta, kime?</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label>Ad *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Rapor</Label>
                <Select
                  value={form.reportType}
                  onValueChange={(v) => v && setForm({ ...form, reportType: v as ScheduledReportType })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(REPORT_LABELS) as [ScheduledReportType, string][]).map(([k, l]) => (
                      <SelectItem key={k} value={k}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Sıklık</Label>
                <Select
                  value={form.frequency}
                  onValueChange={(v) => v && setForm({ ...form, frequency: v as ScheduledFrequency })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(FREQUENCY_LABELS) as [ScheduledFrequency, string][]).map(([k, l]) => (
                      <SelectItem key={k} value={k}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.frequency !== "daily" && (
              <div className="grid gap-2">
                <Label>{form.frequency === "weekly" ? "Hafta günü" : "Ay günü (1-28)"}</Label>
                {form.frequency === "weekly" ? (
                  <Select
                    value={form.dayOfPeriod}
                    onValueChange={(v) => v && setForm({ ...form, dayOfPeriod: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map((d, i) => (
                        <SelectItem key={d} value={String(i)}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={28}
                    value={form.dayOfPeriod}
                    onChange={(e) => setForm({ ...form, dayOfPeriod: e.target.value })}
                  />
                )}
              </div>
            )}
            <div className="grid gap-2">
              <Label>Saat (0-23)</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={23}
                value={form.hourOfDay}
                onChange={(e) => setForm({ ...form, hourOfDay: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Alıcılar (e-posta)</Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={form.recipientInput}
                  onChange={(e) => setForm({ ...form, recipientInput: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addRecipient();
                    }
                  }}
                  placeholder="ornek@firma.com"
                />
                <Button type="button" variant="outline" onClick={addRecipient}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {form.recipients.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.recipients.map((r) => (
                    <Badge key={r} variant="secondary" className="text-xs">
                      {r}
                      <button
                        type="button"
                        onClick={() =>
                          setForm({ ...form, recipients: form.recipients.filter((x) => x !== r) })
                        }
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer pt-1">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              Aktif
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>İptal</Button>
            <Button onClick={submit}>{form.id ? "Kaydet" : "Oluştur"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Zamanlama silinsin mi?"
        variant="destructive"
        confirmLabel="Sil"
        onConfirm={handleDelete}
      />
    </div>
  );
}
