import { useState, useCallback, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ImportReviewTable, type PreviewRow, type ReviewRow } from '@/components/upload/ImportReviewTable';
import {
  Upload as UploadIcon,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  RefreshCw,
  Building2,
  CreditCard,
  Plus,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Account {
  id: string;
  name: string;
  account_type: 'bank' | 'credit_card';
  institution: string | null;
  last4: string | null;
}

interface UploadRecord {
  id: string;
  filename: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  source_type: 'bank' | 'credit_card';
  row_count: number | null;
  processed_count: number | null;
  duplicate_count: number | null;
  error_message: string | null;
  uploaded_at: string;
  completed_at: string | null;
}

export default function Upload() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [currentFilename, setCurrentFilename] = useState('');

  const { user, session } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);
  const sourceType = selectedAccount?.account_type || 'bank';

  useEffect(() => {
    if (user) {
      fetchAccounts();
      fetchUploads();
    }
  }, [user]);

  async function fetchAccounts() {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, name, account_type, institution, last4')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      setAccounts((data as Account[]) || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUploads() {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('statement_uploads')
        .select('*')
        .eq('user_id', user.id)
        .order('uploaded_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setUploads((data as any[]) || []);
    } catch (error) {
      console.error('Error fetching uploads:', error);
    }
  }

  const handleFileUpload = useCallback(async (file: File) => {
    if (!user || !session || !selectedAccountId) return;

    if (!file.name.endsWith('.csv')) {
      toast({ variant: 'destructive', title: 'Invalid file type', description: 'Please upload a CSV file.' });
      return;
    }

    setUploading(true);
    setCurrentFilename(file.name);
    try {
      const text = await file.text();

      const { data, error } = await supabase.functions.invoke('process-csv', {
        body: {
          mode: 'preview',
          csvContent: text,
          sourceType,
          accountId: selectedAccountId,
        },
      });

      if (error) throw error;

      const previewRows: PreviewRow[] = data.rows || [];
      const mapped: ReviewRow[] = previewRows.map(r => ({
        ...r,
        category: r.suggestedCategory,
        type: r.suggestedType,
        included: !r.isDuplicate,
      }));

      setReviewRows(mapped);
      setStep(3);
    } catch (error) {
      console.error('Error previewing file:', error);
      toast({ variant: 'destructive', title: 'Preview failed', description: 'Could not parse the CSV file.' });
    } finally {
      setUploading(false);
    }
  }, [user, session, toast, sourceType, selectedAccountId]);

  async function commitImport() {
    if (!user || !session) return;
    setCommitting(true);
    try {
      const rowsToCommit = reviewRows
        .filter(r => r.included && !r.isDuplicate)
        .map(r => ({
          date: r.date,
          description: r.description,
          amount: r.amount,
          hash: r.hash,
          category: r.category,
          type: r.type,
          needsReview: r.category === 'uncategorized',
        }));

      const { data, error } = await supabase.functions.invoke('process-csv', {
        body: {
          mode: 'commit',
          filename: currentFilename,
          sourceType,
          accountId: selectedAccountId,
          rows: rowsToCommit,
        },
      });

      if (error) throw error;

      const linkedCount = data.linkedCount || 0;
      let desc = `Imported ${data.processedCount} transactions.`;
      if (data.duplicateCount > 0) desc += ` ${data.duplicateCount} duplicates skipped.`;
      if (linkedCount > 0) desc += ` ${linkedCount} CC payments linked.`;

      toast({ title: 'Import complete', description: desc });
      setStep(1);
      setReviewRows([]);
      setCurrentFilename('');
      fetchUploads();
    } catch (error) {
      console.error('Error committing import:', error);
      toast({ variant: 'destructive', title: 'Import failed', description: 'Please try again.' });
    } finally {
      setCommitting(false);
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    e.target.value = '';
  };

  function handleRowChange(index: number, updates: Partial<ReviewRow>) {
    setReviewRows(prev => prev.map((r, i) => i === index ? { ...r, ...updates } : r));
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-5 w-5 text-success" />;
      case 'failed': return <XCircle className="h-5 w-5 text-destructive" />;
      case 'processing': return <Loader2 className="h-5 w-5 text-info animate-spin" />;
      default: return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  }

  function getStatusText(status: string) {
    switch (status) {
      case 'completed': return 'pill-income';
      case 'failed': return 'pill-expense';
      case 'processing': return 'pill-transfer';
      default: return 'pill-neutral';
    }
  }

  return (
    <AppLayout>
      <div className="page-container">
        <div className="mb-8">
          <h1 className="page-title">Upload Statements</h1>
          <p className="page-description">Import bank or credit card statements in CSV format</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-6">
          {[
            { num: 1, label: 'Select Account' },
            { num: 2, label: 'Upload File' },
            { num: 3, label: 'Review & Import' },
          ].map(({ num, label }) => (
            <div key={num} className="flex items-center gap-2">
              {num > 1 && <div className={`h-px w-8 ${step >= num ? 'bg-primary' : 'bg-border'}`} />}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                step === num ? 'bg-primary text-primary-foreground' :
                step > num ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
              }`}>
                <span className="w-5 h-5 flex items-center justify-center rounded-full text-xs">
                  {step > num ? '✓' : num}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Step 1: Select Account */}
        {step === 1 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-lg">Select Account</CardTitle>
              <CardDescription>Choose which account this statement belongs to</CardDescription>
            </CardHeader>
            <CardContent>
              {accounts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">You need to create an account first</p>
                  <Button onClick={() => navigate('/accounts')} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Account
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {accounts.map((account) => (
                      <button
                        key={account.id}
                        onClick={() => setSelectedAccountId(account.id)}
                        className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-colors text-left ${
                          selectedAccountId === account.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${account.account_type === 'credit_card' ? 'bg-accent/10' : 'bg-primary/10'}`}>
                          {account.account_type === 'credit_card'
                            ? <CreditCard className={`h-5 w-5 ${selectedAccountId === account.id ? 'text-primary' : 'text-muted-foreground'}`} />
                            : <Building2 className={`h-5 w-5 ${selectedAccountId === account.id ? 'text-primary' : 'text-muted-foreground'}`} />
                          }
                        </div>
                        <div>
                          <p className={`font-medium text-sm ${selectedAccountId === account.id ? 'text-primary' : ''}`}>
                            {account.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {account.account_type === 'credit_card' ? 'Credit Card' : 'Bank'}
                            {account.last4 && ` •••• ${account.last4}`}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={() => setStep(2)} disabled={!selectedAccountId} className="gap-2">
                      Continue <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Upload File */}
        {step === 2 && (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Upload Statement</CardTitle>
                  <CardDescription>
                    Importing to: <span className="font-medium text-foreground">{selectedAccount?.name}</span>
                    {' '}({sourceType === 'credit_card' ? 'Credit Card' : 'Bank'})
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="gap-1">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div
                className={`
                  border-2 border-dashed rounded-xl p-12 text-center transition-colors
                  ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
                  ${uploading ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                `}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => !uploading && document.getElementById('file-input')?.click()}
              >
                <input
                  id="file-input"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileInput}
                  disabled={uploading}
                />

                {uploading ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                    <p className="text-lg font-medium">Parsing your statement...</p>
                    <p className="text-sm text-muted-foreground mt-1">Detecting categories and types</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="p-4 rounded-full bg-primary/10 mb-4">
                      {sourceType === 'credit_card'
                        ? <CreditCard className="h-10 w-10 text-primary" />
                        : <UploadIcon className="h-10 w-10 text-primary" />
                      }
                    </div>
                    <p className="text-lg font-medium">Drop your CSV here</p>
                    <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Review & Import */}
        {step === 3 && (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Review Import</CardTitle>
                  <CardDescription>
                    {currentFilename} → {selectedAccount?.name}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setStep(2); setReviewRows([]); }} className="gap-1">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button onClick={commitImport} disabled={committing} className="gap-2">
                    {committing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Import {reviewRows.filter(r => r.included && !r.isDuplicate).length} Transactions
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ImportReviewTable
                rows={reviewRows}
                onRowChange={handleRowChange}
                sourceType={sourceType}
              />
            </CardContent>
          </Card>
        )}

        {/* CSV Format Guide */}
        {step <= 2 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Supported CSV Formats
              </CardTitle>
              <CardDescription>
                Your CSV should include columns for date, description, and amount
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">Standard Format</h4>
                  <code className="text-xs bg-background px-2 py-1 rounded block">
                    Date, Description, Amount
                  </code>
                  <p className="text-xs text-muted-foreground mt-2">
                    Single amount column with +/- for inflow/outflow
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">Debit/Credit Format</h4>
                  <code className="text-xs bg-background px-2 py-1 rounded block">
                    Date, Description, Debit, Credit
                  </code>
                  <p className="text-xs text-muted-foreground mt-2">
                    Separate columns for withdrawals and deposits
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload History */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Upload History</CardTitle>
              <CardDescription>Recent statement uploads and their status</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={fetchUploads}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {uploads.length === 0 ? (
              <EmptyState
                icon={<FileSpreadsheet className="h-12 w-12" />}
                title="No uploads yet"
                description="Upload your first statement to get started"
              />
            ) : (
              <div className="space-y-3">
                {uploads.map((upload) => (
                  <div key={upload.id} className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
                    {getStatusIcon(upload.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{upload.filename}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          upload.source_type === 'credit_card'
                            ? 'bg-accent/10 text-accent-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {upload.source_type === 'credit_card' ? 'Credit Card' : 'Bank'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className={getStatusText(upload.status)}>
                          {upload.status.charAt(0).toUpperCase() + upload.status.slice(1)}
                        </span>
                        {upload.status === 'completed' && (
                          <>
                            <span>{upload.processed_count} imported</span>
                            {upload.duplicate_count && upload.duplicate_count > 0 && (
                              <span>{upload.duplicate_count} duplicates</span>
                            )}
                          </>
                        )}
                        {upload.status === 'failed' && upload.error_message && (
                          <span className="text-destructive">{upload.error_message}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {new Date(upload.uploaded_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
