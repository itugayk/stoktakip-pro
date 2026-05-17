"use client";

import { useState, useEffect } from "react";
import {
  Plus, Edit, Trash2, Tag, Search, MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/shared";
import { getCategories, createCategory, updateCategory, deleteCategory, getProducts } from "@/lib/actions";
import type { Category, ProductWithStock } from "@/lib/types";

const EMOJI_OPTIONS = ["📦", "💊", "🧬", "💄", "🥤", "🩺", "🧴", "🍼", "📎", "🔧", "🍽️", "👕", "🎮", "📱", "🏠"];
const COLOR_OPTIONS = ["#6366f1", "#22c55e", "#ec4899", "#f59e0b", "#06b6d4", "#8b5cf6", "#f43f5e", "#14b8a6", "#ef4444", "#3b82f6"];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ name: "", icon: "📦", color: "#6366f1" });

  useEffect(() => {
    async function load() {
      try {
        const [c, p] = await Promise.all([getCategories(), getProducts(undefined)]);
        if (c.ok) setCategories(c.data);
        if (p.ok) setProducts(p.data);
        if (!c.ok || !p.ok) toast.error("Veriler yüklenemedi");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const getProductCount = (categoryId: string) =>
    products.filter((p) => p.categoryId === categoryId).length;

  const filtered = categories.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async () => {
    if (!form.name.trim()) { toast.error("Kategori adı zorunludur"); return; }
    const result = await createCategory({ name: form.name, icon: form.icon, color: form.color });
    if (result.ok) {
      const newCat: Category = { id: result.data.id, name: form.name, icon: form.icon, color: form.color };
      setCategories((prev) => [...prev, newCat]);
      setShowAddDialog(false);
      setForm({ name: "", icon: "📦", color: "#6366f1" });
      toast.success("Kategori eklendi");
    } else { toast.error(result.error.message); }
  };

  const openEdit = (cat: Category) => {
    setEditingCategory(cat);
    setForm({ name: cat.name, icon: cat.icon || "📦", color: cat.color || "#6366f1" });
    setShowEditDialog(true);
  };

  const handleEdit = async () => {
    if (!editingCategory || !form.name.trim()) { toast.error("Kategori adı zorunludur"); return; }
    const result = await updateCategory({
      id: editingCategory.id,
      patch: { name: form.name, icon: form.icon, color: form.color },
    });
    if (result.ok) {
      setCategories((prev) => prev.map((c) =>
        c.id === editingCategory.id ? { ...c, name: form.name, icon: form.icon, color: form.color } : c
      ));
      setShowEditDialog(false);
      setEditingCategory(null);
      toast.success("Kategori güncellendi");
    } else { toast.error(result.error.message); }
  };

  const handleDelete = async (id: string) => {
    const count = getProductCount(id);
    if (count > 0) {
      toast.error(`Bu kategoride ${count} ürün var, önce ürünleri taşıyın`);
      return;
    }
    const result = await deleteCategory(id);
    if (result.ok) {
      setCategories((prev) => prev.filter((c) => c.id !== id));
      toast.success("Kategori silindi");
    } else { toast.error(result.error.message); }
  };

  const renderForm = () => (
    <div className="grid gap-4 py-2">
      <div className="grid gap-2">
        <Label>Kategori Adı *</Label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Kategori adı" />
      </div>
      <div className="grid gap-2">
        <Label>Simge</Label>
        <div className="flex flex-wrap gap-2">
          {EMOJI_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setForm({ ...form, icon: emoji })}
              className={`flex h-10 w-10 items-center justify-center rounded-lg border-2 text-lg transition-all ${
                form.icon === emoji ? "border-primary bg-primary/10 scale-110" : "border-border hover:border-primary/50"
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-2">
        <Label>Renk</Label>
        <div className="flex flex-wrap gap-2">
          {COLOR_OPTIONS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setForm({ ...form, color })}
              className={`h-8 w-8 rounded-full border-2 transition-all ${
                form.color === color ? "border-foreground scale-110 ring-2 ring-offset-2 ring-primary" : "border-transparent"
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Kategoriler"
        description={`${categories.length} kategori`}
        actions={
          <Button onClick={() => { setForm({ name: "", icon: "📦", color: "#6366f1" }); setShowAddDialog(true); }}>
            <Plus className="mr-2 h-4 w-4" />Kategori Ekle
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Kategori ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (<div key={i} className="h-12 rounded-lg bg-muted/50 animate-pulse" />))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="text-right">Ürün Sayısı</TableHead>
                  <TableHead className="text-center w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((cat) => (
                  <TableRow key={cat.id} className="group hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-lg"
                          style={{ backgroundColor: (cat.color || "#6366f1") + "20" }}
                        >
                          {cat.icon || "📦"}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{cat.name}</p>
                          <div className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color || "#6366f1" }} />
                            <span className="text-[10px] text-muted-foreground font-mono">{cat.color || "#6366f1"}</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className="text-xs">{getProductCount(cat.id)} ürün</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(cat)}>
                            <Edit className="mr-2 h-4 w-4" />Düzenle
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(cat.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />Sil
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={3} className="p-0">
                      <EmptyState
                        icon={Tag}
                        title={search ? "Eşleşen kategori yok" : "Henüz kategori yok"}
                        description={search ? "Farklı bir arama deneyin." : "Ürünlerinizi gruplamak için ilk kategoriyi oluşturun."}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Kategori</DialogTitle>
            <DialogDescription>Ürünlerinizi gruplamak için yeni kategori oluşturun</DialogDescription>
          </DialogHeader>
          {renderForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>İptal</Button>
            <Button onClick={handleAdd}>Ekle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Kategori Düzenle</DialogTitle>
            <DialogDescription>Kategori bilgilerini güncelleyin</DialogDescription>
          </DialogHeader>
          {renderForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>İptal</Button>
            <Button onClick={handleEdit}>Güncelle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
