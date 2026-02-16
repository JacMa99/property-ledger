import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/common/EmptyState';
import { MoneyAmount } from '@/components/common/MoneyAmount';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/constants';
import { 
  FolderOpen, 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2,
  DollarSign
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string | null;
  budget: number | null;
  is_active: boolean;
  created_at: string;
  transaction_count?: number;
  total_spent?: number;
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', budget: '' });

  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) fetchProjects();
  }, [user]);

  async function fetchProjects() {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get transaction counts and totals per project
      const { data: txData } = await supabase
        .from('transactions')
        .select('project_id, amount, type')
        .eq('user_id', user.id)
        .not('project_id', 'is', null);

      const projectStats: Record<string, { count: number; spent: number }> = {};
      txData?.forEach((tx: any) => {
        const pid = tx.project_id;
        if (!projectStats[pid]) projectStats[pid] = { count: 0, spent: 0 };
        projectStats[pid].count++;
        const amt = typeof tx.amount === 'string' ? parseFloat(tx.amount) : Number(tx.amount);
        if (tx.type === 'expense') projectStats[pid].spent += Math.abs(amt);
      });

      setProjects((data || []).map((p: any) => ({
        ...p,
        budget: p.budget ? Number(p.budget) : null,
        transaction_count: projectStats[p.id]?.count || 0,
        total_spent: projectStats[p.id]?.spent || 0,
      })));
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ name: '', description: '', budget: '' });
    setShowDialog(true);
  }

  function openEdit(project: Project) {
    setEditing(project);
    setForm({
      name: project.name,
      description: project.description || '',
      budget: project.budget ? String(project.budget) : '',
    });
    setShowDialog(true);
  }

  async function saveProject() {
    if (!user || !form.name) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        budget: form.budget ? parseFloat(form.budget) : null,
        user_id: user.id,
      };

      if (editing) {
        const { error } = await supabase.from('projects').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast({ title: 'Project updated' });
      } else {
        const { error } = await supabase.from('projects').insert(payload);
        if (error) throw error;
        toast({ title: 'Project created' });
      }
      setShowDialog(false);
      fetchProjects();
    } catch (error) {
      console.error('Error saving project:', error);
      toast({ variant: 'destructive', title: 'Error saving project' });
    } finally {
      setSaving(false);
    }
  }

  async function deleteProject(id: string) {
    try {
      // Unlink transactions first
      await supabase.from('transactions').update({ project_id: null }).eq('project_id', id);
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Project deleted' });
      fetchProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({ variant: 'destructive', title: 'Error deleting project' });
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="page-container flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="page-container">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="page-title">Projects</h1>
            <p className="page-description">Track expenses by project or renovation</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>

        {projects.length === 0 ? (
          <EmptyState
            icon={<FolderOpen className="h-12 w-12" />}
            title="No projects yet"
            description="Create a project to start tracking grouped expenses"
            action={{ label: 'Create Project', onClick: openCreate }}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card key={project.id}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <CardTitle className="text-base font-medium">{project.name}</CardTitle>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(project)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteProject(project.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {project.description && (
                    <p className="text-sm text-muted-foreground mb-3">{project.description}</p>
                  )}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Transactions</span>
                      <span className="font-medium">{project.transaction_count}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Spent</span>
                      <span className="font-medium text-destructive">{formatCurrency(project.total_spent || 0)}</span>
                    </div>
                    {project.budget && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Budget</span>
                        <span className="font-medium">{formatCurrency(project.budget)}</span>
                      </div>
                    )}
                    {project.budget && (
                      <div className="w-full bg-muted rounded-full h-2 mt-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            (project.total_spent || 0) > project.budget ? 'bg-destructive' : 'bg-primary'
                          }`}
                          style={{ width: `${Math.min(100, ((project.total_spent || 0) / project.budget) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Project' : 'New Project'}</DialogTitle>
              <DialogDescription>
                {editing ? 'Update project details' : 'Create a project to group related expenses'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Kitchen Renovation" />
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description" />
              </div>
              <div className="space-y-2">
                <Label>Budget (optional)</Label>
                <Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="0.00" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button onClick={saveProject} disabled={saving || !form.name}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editing ? 'Save' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
