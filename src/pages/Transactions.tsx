import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/common/EmptyState';
import { CategoryBadge } from '@/components/common/CategoryBadge';
import { MoneyAmount } from '@/components/common/MoneyAmount';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { formatDate, CATEGORY_OPTIONS, TYPE_CONFIG, TYPE_OPTIONS, getDefaultTypeForCategory } from '@/lib/constants';
import { 
  ArrowUpDown, 
  Search, 
  Filter, 
  Pencil,
  Loader2,
  AlertCircle,
  ListFilter,
  X,
  ChevronRight,
  ChevronDown,
  CreditCard
} from 'lucide-react';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  subcategory: string | null;
  type: 'income' | 'expense' | 'transfer' | 'cc_payment';
  property_id: string | null;
  unit_id: string | null;
  project_id: string | null;
  parent_transaction_id: string | null;
  needs_review: boolean;
  property?: { name: string } | null;
  unit?: { label: string } | null;
  children?: Transaction[];
}

interface Property {
  id: string;
  name: string;
  units: { id: string; label: string }[];
}

interface Project {
  id: string;
  name: string;
}

export default function Transactions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [needsReviewFilter, setNeedsReviewFilter] = useState(searchParams.get('needsReview') === 'true');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  
  // Edit form
  const [editForm, setEditForm] = useState({
    category: '',
    subcategory: '',
    type: 'expense' as string,
    property_id: '',
    unit_id: '',
    project_id: '',
    needs_review: false,
    type_overridden: false,
  });
  
  // Rule form
  const [ruleForm, setRuleForm] = useState({
    name: '',
    pattern: '',
    match_type: 'contains' as 'contains' | 'regex',
    category: '',
    property_id: '',
  });

  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchTransactions();
      fetchProperties();
      fetchProjects();
    }
  }, [user]);

  async function fetchTransactions() {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id, date, description, amount, category, subcategory, type,
          property_id, unit_id, project_id, parent_transaction_id, needs_review,
          property:properties(name),
          unit:units(label)
        `)
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(500);

      if (error) throw error;
      
      const allTx = data?.map(tx => ({
        ...tx,
        amount: typeof tx.amount === 'string' ? parseFloat(tx.amount) : Number(tx.amount),
        type: (tx as any).type || 'expense',
        project_id: (tx as any).project_id || null,
        parent_transaction_id: (tx as any).parent_transaction_id || null,
        property: tx.property as { name: string } | null,
        unit: tx.unit as { label: string } | null,
      })) || [];

      // Build parent-child hierarchy
      const childMap: Record<string, Transaction[]> = {};
      const parentTxs: Transaction[] = [];

      for (const tx of allTx) {
        if (tx.parent_transaction_id) {
          if (!childMap[tx.parent_transaction_id]) childMap[tx.parent_transaction_id] = [];
          childMap[tx.parent_transaction_id].push(tx);
        } else {
          parentTxs.push(tx);
        }
      }

      // Attach children to parents
      for (const tx of parentTxs) {
        tx.children = childMap[tx.id] || [];
      }

      setTransactions(parentTxs);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast({ variant: 'destructive', title: 'Error loading transactions' });
    } finally {
      setLoading(false);
    }
  }

  async function fetchProperties() {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('properties')
        .select('id, name, units(id, label)')
        .eq('user_id', user.id)
        .order('name');
      setProperties(data || []);
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  }

  async function fetchProjects() {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('projects')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('name');
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  }

  async function saveTransaction() {
    if (!editingTx) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          category: editForm.category as any,
          subcategory: editForm.subcategory || null,
          type: editForm.type as any,
          property_id: editForm.property_id || null,
          unit_id: editForm.unit_id || null,
          project_id: editForm.project_id || null,
          needs_review: editForm.needs_review,
          type_overridden: editForm.type_overridden,
        })
        .eq('id', editingTx.id);

      if (error) throw error;
      toast({ title: 'Transaction updated' });
      setShowEditDialog(false);
      fetchTransactions();
    } catch (error) {
      console.error('Error updating transaction:', error);
      toast({ variant: 'destructive', title: 'Error updating transaction' });
    } finally {
      setSaving(false);
    }
  }

  async function createRule() {
    if (!user || !ruleForm.name || !ruleForm.pattern || !ruleForm.category) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('rules')
        .insert({
          user_id: user.id,
          name: ruleForm.name,
          pattern: ruleForm.pattern,
          match_type: ruleForm.match_type as any,
          category: ruleForm.category as any,
          property_id: ruleForm.property_id || null,
          priority: 0,
        });

      if (error) throw error;
      toast({ title: 'Rule created', description: 'Future transactions matching this pattern will be auto-categorized.' });
      setShowRuleDialog(false);
      setRuleForm({ name: '', pattern: '', match_type: 'contains', category: '', property_id: '' });
    } catch (error) {
      console.error('Error creating rule:', error);
      toast({ variant: 'destructive', title: 'Error creating rule' });
    } finally {
      setSaving(false);
    }
  }

  function openEditDialog(tx: Transaction) {
    setEditingTx(tx);
    setEditForm({
      category: tx.category,
      subcategory: tx.subcategory || '',
      type: tx.type || 'expense',
      property_id: tx.property_id || '',
      unit_id: tx.unit_id || '',
      project_id: tx.project_id || '',
      needs_review: tx.needs_review,
      type_overridden: (tx as any).type_overridden || false,
    });
    setShowEditDialog(true);
  }

  function openRuleDialog(tx: Transaction) {
    setRuleForm({
      name: `Rule for "${tx.description.slice(0, 30)}..."`,
      pattern: tx.description.split(' ').slice(0, 3).join(' '),
      match_type: 'contains',
      category: tx.category,
      property_id: tx.property_id || '',
    });
    setShowRuleDialog(true);
  }

  function toggleExpand(id: string) {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Filter transactions
  const filteredTransactions = transactions.filter((tx) => {
    if (searchQuery && !tx.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (categoryFilter !== 'all' && tx.category !== categoryFilter) return false;
    if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
    if (needsReviewFilter && !tx.needs_review) return false;
    if (propertyFilter !== 'all' && tx.property_id !== propertyFilter) return false;
    return true;
  });

  const selectedPropertyUnits = properties.find(p => p.id === editForm.property_id)?.units || [];

  function renderTransactionRow(tx: Transaction, isChild = false) {
    const displayAmount = (tx.type === 'expense' || tx.type === 'cc_payment') ? -Math.abs(tx.amount) : Math.abs(tx.amount);
    const typeConf = TYPE_CONFIG[tx.type] || TYPE_CONFIG.expense;
    const hasChildren = (tx.children?.length || 0) > 0;
    const isExpanded = expandedRows.has(tx.id);

    return (
      <TableRow key={tx.id} className={`${tx.needs_review ? 'bg-warning/5' : ''} ${isChild ? 'bg-muted/20' : ''}`}>
        <TableCell className="text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            {isChild && <span className="text-muted-foreground/50 ml-4">└</span>}
            {!isChild && hasChildren && (
              <button onClick={() => toggleExpand(tx.id)} className="p-0.5 hover:bg-muted rounded">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            )}
            {!isChild && !hasChildren && <span className="w-5" />}
            {formatDate(tx.date)}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            {tx.needs_review && <AlertCircle className="h-4 w-4 text-warning flex-shrink-0" />}
            {isChild && <CreditCard className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
            <span className="truncate max-w-[300px]">{tx.description}</span>
            {hasChildren && !isExpanded && (
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {tx.children!.length} items
              </span>
            )}
          </div>
        </TableCell>
        <TableCell>
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${typeConf.color.replace('pill-', 'bg-') + '/10'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${
              tx.type === 'income' ? 'bg-success' :
              tx.type === 'expense' ? 'bg-destructive' : 'bg-info'
            }`} />
            {typeConf.label}
          </span>
        </TableCell>
        <TableCell><CategoryBadge category={tx.category} /></TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {tx.property?.name || '—'}
          {tx.unit?.label && ` / ${tx.unit.label}`}
        </TableCell>
        <TableCell className="text-right">
          <MoneyAmount amount={displayAmount} />
        </TableCell>
        <TableCell>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(tx)}>
              <Pencil className="h-4 w-4" />
            </Button>
            {!isChild && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openRuleDialog(tx)}>
                <ListFilter className="h-4 w-4" />
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="page-title">Transactions</h1>
            <p className="page-description">{filteredTransactions.length} of {transactions.length} transactions</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6 p-4 bg-card rounded-lg border">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search descriptions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORY_OPTIONS.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={propertyFilter} onValueChange={setPropertyFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Property" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Properties</SelectItem>
              {properties.map((prop) => (
                <SelectItem key={prop.id} value={prop.id}>{prop.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={needsReviewFilter ? 'default' : 'outline'}
            onClick={() => setNeedsReviewFilter(!needsReviewFilter)}
            className="gap-2"
          >
            <AlertCircle className="h-4 w-4" />
            Needs Review
          </Button>
          {(searchQuery || categoryFilter !== 'all' || typeFilter !== 'all' || needsReviewFilter || propertyFilter !== 'all') && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('all');
                setTypeFilter('all');
                setNeedsReviewFilter(false);
                setPropertyFilter('all');
              }}
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {/* Transactions Table */}
        {transactions.length === 0 ? (
          <EmptyState
            icon={<ArrowUpDown className="h-12 w-12" />}
            title="No transactions yet"
            description="Upload a bank statement to import transactions"
          />
        ) : filteredTransactions.length === 0 ? (
          <EmptyState
            icon={<Filter className="h-12 w-12" />}
            title="No matching transactions"
            description="Try adjusting your filters"
          />
        ) : (
          <div className="bg-card rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[130px]">Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((tx) => (
                  <>
                    {renderTransactionRow(tx)}
                    {expandedRows.has(tx.id) && tx.children?.map((child) => (
                      renderTransactionRow(child, true)
                    ))}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Edit Transaction Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Transaction</DialogTitle>
              <DialogDescription>
                {editingTx?.description}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={editForm.category} onValueChange={(v) => {
                  const newType = editForm.type_overridden ? editForm.type : getDefaultTypeForCategory(v);
                  setEditForm({ ...editForm, category: v, type: newType });
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={editForm.type} onValueChange={(v) => setEditForm({ ...editForm, type: v, type_overridden: true })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        <span className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${
                            t.value === 'income' ? 'bg-success' :
                            t.value === 'expense' ? 'bg-destructive' : 'bg-info'
                          }`} />
                          {t.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subcategory (optional)</Label>
                <Input value={editForm.subcategory} onChange={(e) => setEditForm({ ...editForm, subcategory: e.target.value })} placeholder="e.g., Plumbing, HVAC" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Property</Label>
                  <Select value={editForm.property_id || 'none'} onValueChange={(v) => setEditForm({ ...editForm, property_id: v === 'none' ? '' : v, unit_id: '' })}>
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
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Select 
                    value={editForm.unit_id || 'none'} 
                    onValueChange={(v) => setEditForm({ ...editForm, unit_id: v === 'none' ? '' : v })}
                    disabled={!editForm.property_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {selectedPropertyUnits.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>{unit.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Project (optional)</Label>
                <Select value={editForm.project_id || 'none'} onValueChange={(v) => setEditForm({ ...editForm, project_id: v === 'none' ? '' : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {projects.map((proj) => (
                      <SelectItem key={proj.id} value={proj.id}>{proj.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="needsReview"
                  checked={editForm.needs_review}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, needs_review: checked as boolean })}
                />
                <Label htmlFor="needsReview" className="text-sm font-normal">Needs review</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
              <Button onClick={saveTransaction} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Rule Dialog */}
        <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Rule from Transaction</DialogTitle>
              <DialogDescription>
                Create a rule to automatically categorize similar transactions.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Rule Name</Label>
                <Input value={ruleForm.name} onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Match Pattern</Label>
                <Input value={ruleForm.pattern} onChange={(e) => setRuleForm({ ...ruleForm, pattern: e.target.value })} placeholder="Text to match in description" />
              </div>
              <div className="space-y-2">
                <Label>Match Type</Label>
                <Select value={ruleForm.match_type} onValueChange={(v: 'contains' | 'regex') => setRuleForm({ ...ruleForm, match_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">Contains</SelectItem>
                    <SelectItem value="regex">Regex</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category to Apply</Label>
                <Select value={ruleForm.category} onValueChange={(v) => setRuleForm({ ...ruleForm, category: v })}>
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
                <Label>Property (optional)</Label>
                <Select value={ruleForm.property_id || 'none'} onValueChange={(v) => setRuleForm({ ...ruleForm, property_id: v === 'none' ? '' : v })}>
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
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRuleDialog(false)}>Cancel</Button>
              <Button onClick={createRule} disabled={saving || !ruleForm.name || !ruleForm.pattern || !ruleForm.category}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Rule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
