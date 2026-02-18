import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Building2, CreditCard, Plus, Pencil, Trash2, Loader2, Wallet } from 'lucide-react';

interface Account {
  id: string;
  name: string;
  account_type: 'bank' | 'credit_card';
  institution: string | null;
  last4: string | null;
  is_active: boolean;
}

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    account_type: 'bank' as 'bank' | 'credit_card',
    institution: '',
    last4: '',
  });

  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) fetchAccounts();
  }, [user]);

  async function fetchAccounts() {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAccounts((data as Account[]) || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ name: '', account_type: 'bank', institution: '', last4: '' });
    setShowDialog(true);
  }

  function openEdit(account: Account) {
    setEditing(account);
    setForm({
      name: account.name,
      account_type: account.account_type,
      institution: account.institution || '',
      last4: account.last4 || '',
    });
    setShowDialog(true);
  }

  async function saveAccount() {
    if (!user || !form.name) return;
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from('accounts')
          .update({
            name: form.name,
            account_type: form.account_type as any,
            institution: form.institution || null,
            last4: form.last4 || null,
          })
          .eq('id', editing.id);
        if (error) throw error;
        toast({ title: 'Account updated' });
      } else {
        const { error } = await supabase
          .from('accounts')
          .insert({
            user_id: user.id,
            name: form.name,
            account_type: form.account_type as any,
            institution: form.institution || null,
            last4: form.last4 || null,
          });
        if (error) throw error;
        toast({ title: 'Account created' });
      }
      setShowDialog(false);
      fetchAccounts();
    } catch (error) {
      console.error('Error saving account:', error);
      toast({ variant: 'destructive', title: 'Error saving account' });
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount(id: string) {
    if (!confirm('Delete this account? Transactions linked to it will not be deleted.')) return;
    try {
      const { error } = await supabase.from('accounts').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Account deleted' });
      fetchAccounts();
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({ variant: 'destructive', title: 'Error deleting account' });
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
            <h1 className="page-title">Accounts</h1>
            <p className="page-description">Manage your bank and credit card accounts</p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Account
          </Button>
        </div>

        {accounts.length === 0 ? (
          <EmptyState
            icon={<Wallet className="h-12 w-12" />}
            title="No accounts yet"
            description="Add a bank or credit card account to start importing statements"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((account) => (
              <Card key={account.id} className="relative group">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${account.account_type === 'credit_card' ? 'bg-accent/10' : 'bg-primary/10'}`}>
                      {account.account_type === 'credit_card'
                        ? <CreditCard className="h-6 w-6 text-accent" />
                        : <Building2 className="h-6 w-6 text-primary" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{account.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {account.account_type === 'credit_card' ? 'Credit Card' : 'Bank Account'}
                        {account.last4 && ` •••• ${account.last4}`}
                      </p>
                      {account.institution && (
                        <p className="text-xs text-muted-foreground mt-1">{account.institution}</p>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(account)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteAccount(account.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Account' : 'Add Account'}</DialogTitle>
              <DialogDescription>
                {editing ? 'Update account details' : 'Create a new bank or credit card account'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Account Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Chase Checking"
                />
              </div>
              <div className="space-y-2">
                <Label>Account Type</Label>
                <Select
                  value={form.account_type}
                  onValueChange={(v: 'bank' | 'credit_card') => setForm({ ...form, account_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">
                      <span className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" /> Bank Account
                      </span>
                    </SelectItem>
                    <SelectItem value="credit_card">
                      <span className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" /> Credit Card
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Institution (optional)</Label>
                <Input
                  value={form.institution}
                  onChange={(e) => setForm({ ...form, institution: e.target.value })}
                  placeholder="e.g., Chase, Bank of America"
                />
              </div>
              <div className="space-y-2">
                <Label>Last 4 digits (optional)</Label>
                <Input
                  value={form.last4}
                  onChange={(e) => setForm({ ...form, last4: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  placeholder="1234"
                  maxLength={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button onClick={saveAccount} disabled={saving || !form.name}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editing ? 'Save Changes' : 'Create Account'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
