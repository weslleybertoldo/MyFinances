import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, ChevronRight, ChevronDown, FolderPlus } from "lucide-react";
import { formatCurrency } from "@/lib/mock-data";
import {
  useProjects, useCreateProject, useDeleteProject, useUpdateProject,
  useAddProjectItem, useUpdateProjectItem, useDeleteProjectItem,
  type Project,
} from "@/hooks/useProjects";

export default function Projects() {
  const { data: projects = [], isLoading } = useProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const updateProject = useUpdateProject();
  const addItem = useAddProjectItem();
  const updateItem = useUpdateProjectItem();
  const deleteItem = useDeleteProjectItem();

  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Editar nome do projeto
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editProjectName, setEditProjectName] = useState("");

  // Adicionar item
  const [addingItemProjectId, setAddingItemProjectId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({ name: "", value: "", date: "" });

  // Editar item
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState({ name: "", value: "", date: "" });

  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;
    createProject.mutate(newProjectName.trim());
    setNewProjectName("");
    setShowNewProject(false);
  };

  const handleAddItem = (projectId: string) => {
    const value = parseFloat(newItem.value);
    if (!newItem.name.trim() || isNaN(value) || value === 0) return;
    addItem.mutate({
      project_id: projectId,
      name: newItem.name.trim(),
      value,
      date: newItem.date || undefined,
    });
    setNewItem({ name: "", value: "", date: "" });
    setAddingItemProjectId(null);
  };

  const handleUpdateItem = () => {
    if (!editingItemId) return;
    const value = parseFloat(editItem.value);
    if (!editItem.name.trim() || isNaN(value)) return;
    updateItem.mutate({
      id: editingItemId,
      name: editItem.name.trim(),
      value,
      date: editItem.date || null,
    });
    setEditingItemId(null);
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold">Projetos Futuros</h1>
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Projetos Futuros</h1>
        <Button size="sm" onClick={() => setShowNewProject(true)}>
          <FolderPlus className="h-4 w-4 mr-1" />Criar Projeto
        </Button>
      </div>

      {projects.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderPlus className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum projeto criado</p>
            <p className="text-xs text-muted-foreground mt-1">Crie um projeto para planejar seus gastos futuros</p>
          </CardContent>
        </Card>
      )}

      {projects.map((project) => (
        <Card key={project.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <button onClick={() => toggleExpand(project.id)} className="flex items-center gap-2 flex-1 text-left">
                {expandedId === project.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {editingProjectId === project.id ? (
                  <div className="flex items-center gap-2 flex-1" onClick={(e) => e.stopPropagation()}>
                    <Input
                      value={editProjectName}
                      onChange={(e) => setEditProjectName(e.target.value)}
                      className="h-7 text-sm"
                      autoFocus
                    />
                    <Button size="sm" className="h-7 text-xs" onClick={() => {
                      if (editProjectName.trim()) updateProject.mutate({ id: project.id, name: editProjectName.trim() });
                      setEditingProjectId(null);
                    }}>OK</Button>
                  </div>
                ) : (
                  <CardTitle className="text-base">{project.name}</CardTitle>
                )}
              </button>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{formatCurrency(project.total)}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => {
                  e.stopPropagation();
                  setEditingProjectId(project.id);
                  setEditProjectName(project.name);
                }}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDeleteId(project.id);
                }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground ml-6">{project.items.length} itens</p>
          </CardHeader>

          {expandedId === project.id && (
            <CardContent className="pt-0">
              <div className="space-y-2 ml-2">
                {project.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2 rounded border group">
                    {editingItemId === item.id ? (
                      <div className="flex-1 space-y-2">
                        <div className="flex gap-2">
                          <Input value={editItem.name} onChange={(e) => setEditItem({ ...editItem, name: e.target.value })} placeholder="Nome" className="h-7 text-xs" />
                          <Input type="number" value={editItem.value} onChange={(e) => setEditItem({ ...editItem, value: e.target.value })} placeholder="Valor" className="h-7 text-xs w-28" />
                        </div>
                        <div className="flex gap-2">
                          <Input type="date" value={editItem.date} onChange={(e) => setEditItem({ ...editItem, date: e.target.value })} className="h-7 text-xs" />
                          <Button size="sm" className="h-7 text-xs" onClick={handleUpdateItem}>Salvar</Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingItemId(null)}>Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{item.name}</p>
                          {item.date && (
                            <p className="text-[10px] text-muted-foreground">
                              {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Maceio" }).format(new Date(item.date + "T12:00:00"))}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{formatCurrency(item.value)}</span>
                          <div className="opacity-0 group-hover:opacity-100 flex">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                              setEditingItemId(item.id);
                              setEditItem({ name: item.name, value: String(item.value), date: item.date || "" });
                            }}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteItem.mutate(item.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}

                {/* Adicionar item */}
                {addingItemProjectId === project.id ? (
                  <div className="p-2 rounded border border-dashed space-y-2">
                    <Input value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} placeholder="Nome do item" className="h-8 text-xs" />
                    <div className="flex gap-2">
                      <Input type="number" value={newItem.value} onChange={(e) => setNewItem({ ...newItem, value: e.target.value })} placeholder="Valor" className="h-8 text-xs" />
                      <Input type="date" value={newItem.date} onChange={(e) => setNewItem({ ...newItem, date: e.target.value })} className="h-8 text-xs" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 text-xs" onClick={() => handleAddItem(project.id)}>Adicionar</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setAddingItemProjectId(null); setNewItem({ name: "", value: "", date: "" }); }}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => setAddingItemProjectId(project.id)}>
                    <Plus className="h-3 w-3 mr-1" />Adicionar item
                  </Button>
                )}

                {/* Total */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm font-medium">Total do projeto</span>
                  <span className="text-sm font-bold">{formatCurrency(project.total)}</span>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      ))}

      {/* Dialog criar projeto */}
      <Dialog open={showNewProject} onOpenChange={setShowNewProject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Projeto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Nome do projeto (ex: Casa, Carro, Viagem)"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              autoFocus
            />
            <Button className="w-full" onClick={handleCreateProject} disabled={createProject.isPending}>
              {createProject.isPending ? "Criando..." : "Criar Projeto"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog confirmar exclusão */}
      <Dialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Projeto?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Todos os itens deste projeto serão removidos.</p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => { if (confirmDeleteId) deleteProject.mutate(confirmDeleteId); setConfirmDeleteId(null); }}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
