"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  ClipboardList,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import { PageHeader, EmptyState, ConfirmDialog } from "@/components/shared";
import {
  listTasks,
  upsertTask,
  deleteTask,
  updateTaskStatus,
  listTeamMembers,
  type Task,
  type TaskStatus,
  type TaskPriority,
  type TeamMember,
} from "@/lib/actions";
import { cn } from "@/lib/utils";

const PRIORITY_META: Record<TaskPriority, { label: string; color: string }> = {
  low: { label: "Düşük", color: "text-muted-foreground" },
  normal: { label: "Normal", color: "text-blue-500" },
  high: { label: "Yüksek", color: "text-amber-500" },
  urgent: { label: "Acil", color: "text-rose-500" },
};

const STATUS_META: Record<TaskStatus, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  open: { label: "Açık", icon: Circle, color: "text-muted-foreground" },
  in_progress: { label: "Devam", icon: Clock, color: "text-blue-500" },
  done: { label: "Tamam", icon: CheckCircle2, color: "text-emerald-500" },
  cancelled: { label: "İptal", icon: Circle, color: "text-rose-500" },
};

interface FormState {
  id?: string;
  title: string;
  description: string;
  assignedTo: string;
  dueAt: string;
  priority: TaskPriority;
  status: TaskStatus;
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  assignedTo: "",
  dueAt: "",
  priority: "normal",
  status: "open",
};

const FILTERS: { key: "all" | "mine" | TaskStatus; label: string }[] = [
  { key: "all", label: "Tümü" },
  { key: "mine", label: "Bana atanan" },
  { key: "open", label: "Açık" },
  { key: "in_progress", label: "Devam" },
  { key: "done", label: "Tamamlanan" },
];

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    const payload =
      filter === "all"
        ? {}
        : filter === "mine"
        ? { mine: true }
        : { status: filter };
    Promise.all([listTasks(payload), listTeamMembers()]).then(([t, m]) => {
      if (t.ok) setTasks(t.data);
      else toast.error(t.error.message);
      if (m.ok) setMembers(m.data);
      setLoading(false);
    });
  };

  useEffect(refresh, [filter]);

  const overdueCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return tasks.filter((t) => t.dueAt && t.dueAt < today && t.status !== "done" && t.status !== "cancelled").length;
  }, [tasks]);

  const submit = async () => {
    if (!form.title.trim()) {
      toast.error("Başlık zorunlu");
      return;
    }
    const r = await upsertTask({
      id: form.id,
      title: form.title,
      description: form.description || undefined,
      assignedTo: form.assignedTo || undefined,
      dueAt: form.dueAt || undefined,
      priority: form.priority,
      status: form.status,
    });
    if (!r.ok) {
      toast.error(r.error.message);
      return;
    }
    toast.success(form.id ? "Görev güncellendi" : "Görev oluşturuldu");
    setShowDialog(false);
    refresh();
  };

  const toggleStatus = async (task: Task) => {
    const next: TaskStatus =
      task.status === "open" ? "in_progress" : task.status === "in_progress" ? "done" : "open";
    const r = await updateTaskStatus({ id: task.id, status: next });
    if (r.ok) refresh();
    else toast.error(r.error.message);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Görevler"
        description={
          overdueCount > 0
            ? `${tasks.length} görev · ${overdueCount} gecikmiş`
            : `${tasks.length} görev`
        }
        actions={
          <Button
            onClick={() => {
              setForm(EMPTY_FORM);
              setShowDialog(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Yeni Görev
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              filter === f.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-6 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded bg-muted/50 animate-pulse" />
            ))}
          </CardContent>
        </Card>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={ClipboardList}
              title={filter === "mine" ? "Bana atanmış görev yok" : "Henüz görev yok"}
              description="Ekibinize görev atayarak işlerinizi takip edin."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => {
            const statusMeta = STATUS_META[t.status];
            const priorityMeta = PRIORITY_META[t.priority];
            const StatusIcon = statusMeta.icon;
            const isOverdue =
              t.dueAt &&
              t.dueAt < new Date().toISOString().slice(0, 10) &&
              t.status !== "done" &&
              t.status !== "cancelled";
            return (
              <Card key={t.id} className={cn("group", t.status === "done" && "opacity-60")}>
                <CardContent className="p-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleStatus(t)}
                    aria-label={`Durumu değiştir: ${statusMeta.label}`}
                    className="shrink-0"
                  >
                    <StatusIcon className={cn("h-5 w-5", statusMeta.color)} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          t.status === "done" && "line-through"
                        )}
                      >
                        {t.title}
                      </p>
                      <Badge variant="outline" className={cn("text-[10px]", priorityMeta.color)}>
                        {priorityMeta.label}
                      </Badge>
                      {isOverdue && (
                        <Badge variant="destructive" className="text-[10px]">
                          <AlertTriangle className="mr-0.5 h-2.5 w-2.5" />
                          Gecikmiş
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                      {t.assigneeName && <span>{t.assigneeName}</span>}
                      {t.dueAt && (
                        <span>· {new Date(t.dueAt).toLocaleDateString("tr-TR")}</span>
                      )}
                      <span>· {statusMeta.label}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      setForm({
                        id: t.id,
                        title: t.title,
                        description: t.description ?? "",
                        assignedTo: t.assignedTo ?? "",
                        dueAt: t.dueAt ?? "",
                        priority: t.priority,
                        status: t.status,
                      });
                      setShowDialog(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                    onClick={() => setDeleteId(t.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Görevi Düzenle" : "Yeni Görev"}</DialogTitle>
            <DialogDescription>Atayın, son tarih girin, önceliği belirleyin</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label>Başlık *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Açıklama</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Atanan</Label>
                <Select
                  value={form.assignedTo}
                  onValueChange={(v) => setForm({ ...form, assignedTo: typeof v === "string" ? v : "" })}
                >
                  <SelectTrigger><SelectValue placeholder="Kişi seçin" /></SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Son Tarih</Label>
                <Input
                  type="date"
                  value={form.dueAt}
                  onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Öncelik</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => v && setForm({ ...form, priority: v as TaskPriority })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(PRIORITY_META) as [TaskPriority, { label: string }][]).map(([k, m]) => (
                      <SelectItem key={k} value={k}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Durum</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => v && setForm({ ...form, status: v as TaskStatus })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(STATUS_META) as [TaskStatus, { label: string }][]).map(([k, m]) => (
                      <SelectItem key={k} value={k}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
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
        title="Görev silinsin mi?"
        variant="destructive"
        confirmLabel="Sil"
        onConfirm={async () => {
          if (!deleteId) return;
          const r = await deleteTask(deleteId);
          if (r.ok) {
            toast.success("Silindi");
            refresh();
          } else toast.error(r.error.message);
        }}
      />
    </div>
  );
}
