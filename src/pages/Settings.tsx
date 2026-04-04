import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, Trash2, Plus, Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useCategories } from "@/hooks/useCategories";
import { useCreateCategory, useUpdateCategory, useDeleteCategory } from "@/hooks/useCategoryMutations";

type CategoryType = "income" | "expense" | "both";

const TYPE_LABELS: Record<CategoryType, string> = {
  income: "Receita",
  expense: "Despesa",
  both: "Ambos",
};

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const { data: categories = [] } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState({ name: "", color: "#6B7280", type: "expense" as CategoryType });

  const resetForm = () => setForm({ name: "", color: "#6B7280", type: "expense" });

  const handleAdd = () => {
    if (!form.name.trim()) return;
    createCategory.mutate({ name: form.name.trim(), color: form.color, type: form.type });
    resetForm();
    setShowAdd(false);
  };

  const startEdit = (cat: typeof categories[0]) => {
    setEditingId(cat.id);
    setForm({ name: cat.name, color: cat.color, type: cat.type as CategoryType });
  };

  const saveEdit = () => {
    if (!editingId || !form.name.trim()) return;
    updateCategory.mutate({ id: editingId, name: form.name.trim(), color: form.color, type: form.type });
    setEditingId(null);
    resetForm();
  };

  const handleDelete = () => {
    if (!confirmDeleteId || deleteCategory.isPending) return;
    deleteCategory.mutate(confirmDeleteId, {
      onSettled: () => setConfirmDeleteId(null),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Personalize o aplicativo</p>
      </div>

      {/* Tema */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Aparência</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              <div>
                <p className="font-medium text-sm">Tema Escuro</p>
                <p className="text-xs text-muted-foreground">Alterne entre tema claro e escuro</p>
              </div>
            </div>
            <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
          </div>
        </CardContent>
      </Card>

      {/* Categorias */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Categorias</CardTitle>
          <Button size="sm" onClick={() => { resetForm(); setShowAdd(true); }}>
            <Plus className="h-4 w-4 mr-1" />Nova
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {categories.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma categoria</p>
            )}
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between p-3 rounded-lg border">
                {editingId === cat.id ? (
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.color}
                        onChange={(e) => setForm({ ...form, color: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                      />
                      <Input
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={form.type} onValueChange={(v: CategoryType) => setForm({ ...form, type: v })}>
                        <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="expense">Despesa</SelectItem>
                          <SelectItem value="income">Receita</SelectItem>
                          <SelectItem value="both">Ambos</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" onClick={saveEdit}>Salvar</Button>
                      <Button size="sm" variant="outline" onClick={() => { setEditingId(null); resetForm(); }}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <div>
                        <p className="font-medium text-sm">{cat.name}</p>
                        <Badge variant="secondary" className="text-[10px]">{TYPE_LABELS[cat.type as CategoryType] ?? cat.type}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(cat)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setConfirmDeleteId(cat.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dialog: Nova Categoria */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Categoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-10 h-10 rounded cursor-pointer border-0 p-0"
              />
              <Input
                placeholder="Nome da categoria"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="flex-1"
              />
            </div>
            <Select value={form.type} onValueChange={(v: CategoryType) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Despesa</SelectItem>
                <SelectItem value="income">Receita</SelectItem>
                <SelectItem value="both">Ambos</SelectItem>
              </SelectContent>
            </Select>
            <Button className="w-full" onClick={handleAdd} disabled={createCategory.isPending}>
              {createCategory.isPending ? "Criando..." : "Criar Categoria"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar exclusão */}
      <Dialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Categoria?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Lançamentos e transações que usam esta categoria ficarão sem categoria.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteCategory.isPending}>
              {deleteCategory.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
