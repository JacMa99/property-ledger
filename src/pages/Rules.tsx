 import { useState, useEffect } from 'react';
 import { AppLayout } from '@/components/layout/AppLayout';
 import { EmptyState } from '@/components/common/EmptyState';
 import { CategoryBadge } from '@/components/common/CategoryBadge';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Switch } from '@/components/ui/switch';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from '@/components/ui/select';
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
 import { CATEGORY_OPTIONS } from '@/lib/constants';
 import { 
   ListFilter, 
   Plus, 
   Pencil, 
   Trash2,
   Loader2,
   GripVertical,
   ArrowUp,
   ArrowDown
 } from 'lucide-react';
 
 interface Rule {
   id: string;
   name: string;
   match_type: 'contains' | 'regex';
   pattern: string;
   category: string;
   property_id: string | null;
   priority: number;
   is_active: boolean;
   property?: { name: string } | null;
 }
 
 interface Property {
   id: string;
   name: string;
 }
 
 export default function Rules() {
   const [rules, setRules] = useState<Rule[]>([]);
   const [properties, setProperties] = useState<Property[]>([]);
   const [loading, setLoading] = useState(true);
   const [showDialog, setShowDialog] = useState(false);
   const [editingRule, setEditingRule] = useState<Rule | null>(null);
   const [saving, setSaving] = useState(false);
   
   const [form, setForm] = useState({
     name: '',
     pattern: '',
     match_type: 'contains' as 'contains' | 'regex',
     category: '',
     property_id: '',
     is_active: true,
   });
 
   const { user } = useAuth();
   const { toast } = useToast();
 
   useEffect(() => {
     if (user) {
       fetchRules();
       fetchProperties();
     }
   }, [user]);
 
   async function fetchRules() {
     if (!user) return;
     setLoading(true);
     try {
       const { data, error } = await supabase
         .from('rules')
         .select('id, name, match_type, pattern, category, property_id, priority, is_active, property:properties(name)')
         .eq('user_id', user.id)
         .order('priority', { ascending: false });
 
       if (error) throw error;
       setRules(data?.map(r => ({
         ...r,
         property: r.property as { name: string } | null,
       })) || []);
     } catch (error) {
       console.error('Error fetching rules:', error);
       toast({ variant: 'destructive', title: 'Error loading rules' });
     } finally {
       setLoading(false);
     }
   }
 
   async function fetchProperties() {
     if (!user) return;
     try {
       const { data } = await supabase
         .from('properties')
         .select('id, name')
         .eq('user_id', user.id)
         .order('name');
       setProperties(data || []);
     } catch (error) {
       console.error('Error fetching properties:', error);
     }
   }
 
   async function saveRule() {
     if (!user || !form.name || !form.pattern || !form.category) return;
     setSaving(true);
     try {
       if (editingRule) {
         const { error } = await supabase
           .from('rules')
           .update({
             name: form.name,
             pattern: form.pattern,
             match_type: form.match_type as any,
             category: form.category as any,
             property_id: form.property_id || null,
             is_active: form.is_active,
           })
           .eq('id', editingRule.id);
         if (error) throw error;
         toast({ title: 'Rule updated' });
       } else {
         const maxPriority = rules.length > 0 ? Math.max(...rules.map(r => r.priority)) : 0;
         const { error } = await supabase
           .from('rules')
           .insert({
             user_id: user.id,
             name: form.name,
             pattern: form.pattern,
             match_type: form.match_type as any,
             category: form.category as any,
             property_id: form.property_id || null,
             priority: maxPriority + 1,
             is_active: form.is_active,
           });
         if (error) throw error;
         toast({ title: 'Rule created' });
       }
       setShowDialog(false);
       resetForm();
       fetchRules();
     } catch (error) {
       console.error('Error saving rule:', error);
       toast({ variant: 'destructive', title: 'Error saving rule' });
     } finally {
       setSaving(false);
     }
   }
 
   async function deleteRule(id: string) {
     if (!confirm('Delete this rule?')) return;
     try {
       const { error } = await supabase.from('rules').delete().eq('id', id);
       if (error) throw error;
       toast({ title: 'Rule deleted' });
       fetchRules();
     } catch (error) {
       console.error('Error deleting rule:', error);
       toast({ variant: 'destructive', title: 'Error deleting rule' });
     }
   }
 
   async function toggleActive(rule: Rule) {
     try {
       const { error } = await supabase
         .from('rules')
         .update({ is_active: !rule.is_active })
         .eq('id', rule.id);
       if (error) throw error;
       fetchRules();
     } catch (error) {
       console.error('Error toggling rule:', error);
       toast({ variant: 'destructive', title: 'Error updating rule' });
     }
   }
 
   async function movePriority(rule: Rule, direction: 'up' | 'down') {
     const index = rules.findIndex(r => r.id === rule.id);
     if ((direction === 'up' && index === 0) || (direction === 'down' && index === rules.length - 1)) return;
 
     const swapIndex = direction === 'up' ? index - 1 : index + 1;
     const otherRule = rules[swapIndex];
 
     try {
       await Promise.all([
         supabase.from('rules').update({ priority: otherRule.priority }).eq('id', rule.id),
         supabase.from('rules').update({ priority: rule.priority }).eq('id', otherRule.id),
       ]);
       fetchRules();
     } catch (error) {
       console.error('Error updating priority:', error);
       toast({ variant: 'destructive', title: 'Error updating priority' });
     }
   }
 
   function openDialog(rule?: Rule) {
     if (rule) {
       setEditingRule(rule);
       setForm({
         name: rule.name,
         pattern: rule.pattern,
         match_type: rule.match_type,
         category: rule.category,
         property_id: rule.property_id || '',
         is_active: rule.is_active,
       });
     } else {
       resetForm();
     }
     setShowDialog(true);
   }
 
   function resetForm() {
     setEditingRule(null);
     setForm({
       name: '',
       pattern: '',
       match_type: 'contains',
       category: '',
       property_id: '',
       is_active: true,
     });
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
             <h1 className="page-title">Categorization Rules</h1>
             <p className="page-description">Rules are applied in order of priority (highest first)</p>
           </div>
           <Button onClick={() => openDialog()}>
             <Plus className="h-4 w-4 mr-2" />
             Add Rule
           </Button>
         </div>
 
         {rules.length === 0 ? (
           <EmptyState
             icon={<ListFilter className="h-12 w-12" />}
             title="No rules yet"
             description="Create rules to automatically categorize transactions based on patterns"
             action={{ label: 'Create Rule', onClick: () => openDialog() }}
           />
         ) : (
           <div className="space-y-3">
             {rules.map((rule, index) => (
               <Card key={rule.id} className={!rule.is_active ? 'opacity-60' : ''}>
                 <CardContent className="py-4">
                   <div className="flex items-center gap-4">
                     <div className="flex flex-col gap-1">
                       <Button
                         variant="ghost"
                         size="icon"
                         className="h-6 w-6"
                         onClick={() => movePriority(rule, 'up')}
                         disabled={index === 0}
                       >
                         <ArrowUp className="h-3 w-3" />
                       </Button>
                       <Button
                         variant="ghost"
                         size="icon"
                         className="h-6 w-6"
                         onClick={() => movePriority(rule, 'down')}
                         disabled={index === rules.length - 1}
                       >
                         <ArrowDown className="h-3 w-3" />
                       </Button>
                     </div>
                     
                     <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-3">
                         <h3 className="font-medium">{rule.name}</h3>
                         <CategoryBadge category={rule.category} />
                       </div>
                       <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                         <code className="bg-muted px-2 py-0.5 rounded text-xs">
                           {rule.match_type === 'regex' ? 'regex:' : ''}{rule.pattern}
                         </code>
                         {rule.property?.name && (
                           <span>→ {rule.property.name}</span>
                         )}
                       </div>
                     </div>
 
                     <div className="flex items-center gap-3">
                       <Switch
                         checked={rule.is_active}
                         onCheckedChange={() => toggleActive(rule)}
                       />
                       <Button variant="ghost" size="icon" onClick={() => openDialog(rule)}>
                         <Pencil className="h-4 w-4" />
                       </Button>
                       <Button variant="ghost" size="icon" onClick={() => deleteRule(rule.id)}>
                         <Trash2 className="h-4 w-4 text-destructive" />
                       </Button>
                     </div>
                   </div>
                 </CardContent>
               </Card>
             ))}
           </div>
         )}
 
         {/* Rule Dialog */}
         <Dialog open={showDialog} onOpenChange={setShowDialog}>
           <DialogContent>
             <DialogHeader>
               <DialogTitle>{editingRule ? 'Edit Rule' : 'Create Rule'}</DialogTitle>
               <DialogDescription>
                 Rules automatically categorize transactions based on description patterns.
               </DialogDescription>
             </DialogHeader>
             <div className="space-y-4 py-4">
               <div className="space-y-2">
                 <Label>Rule Name *</Label>
                 <Input
                   value={form.name}
                   onChange={(e) => setForm({ ...form, name: e.target.value })}
                   placeholder="e.g., Chase Mortgage Payment"
                 />
               </div>
               <div className="grid grid-cols-3 gap-4">
                 <div className="col-span-2 space-y-2">
                   <Label>Pattern *</Label>
                   <Input
                     value={form.pattern}
                     onChange={(e) => setForm({ ...form, pattern: e.target.value })}
                     placeholder="Text to match"
                   />
                 </div>
                 <div className="space-y-2">
                   <Label>Match Type</Label>
                   <Select
                     value={form.match_type}
                     onValueChange={(v: 'contains' | 'regex') => setForm({ ...form, match_type: v })}
                   >
                     <SelectTrigger>
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="contains">Contains</SelectItem>
                       <SelectItem value="regex">Regex</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
               </div>
               <div className="space-y-2">
                 <Label>Category *</Label>
                 <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                   <SelectTrigger>
                     <SelectValue placeholder="Select category" />
                   </SelectTrigger>
                   <SelectContent>
                     {CATEGORY_OPTIONS.map((cat) => (
                       <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
               <div className="space-y-2">
                 <Label>Auto-assign Property (optional)</Label>
                 <Select
                   value={form.property_id || 'none'}
                   onValueChange={(v) => setForm({ ...form, property_id: v === 'none' ? '' : v })}
                 >
                   <SelectTrigger>
                     <SelectValue placeholder="Select property" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="none">None</SelectItem>
                     {properties.map((prop) => (
                       <SelectItem key={prop.id} value={prop.id}>{prop.name}</SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
               <div className="flex items-center space-x-2">
                 <Switch
                   id="is_active"
                   checked={form.is_active}
                   onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                 />
                 <Label htmlFor="is_active">Rule is active</Label>
               </div>
             </div>
             <DialogFooter>
               <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
               <Button onClick={saveRule} disabled={saving || !form.name || !form.pattern || !form.category}>
                 {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                 {editingRule ? 'Save Changes' : 'Create Rule'}
               </Button>
             </DialogFooter>
           </DialogContent>
         </Dialog>
       </div>
     </AppLayout>
   );
 }