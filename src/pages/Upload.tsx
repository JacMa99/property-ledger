import { useState, useCallback, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { 
  Upload as UploadIcon, 
  FileSpreadsheet, 
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  RefreshCw,
  Building2,
  CreditCard
} from 'lucide-react';

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
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [sourceType, setSourceType] = useState<'bank' | 'credit_card'>('bank');
  
  const { user, session } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) fetchUploads();
  }, [user]);

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
    } finally {
      setLoading(false);
    }
  }

  const handleFileUpload = useCallback(async (file: File) => {
    if (!user || !session) return;
    
    if (!file.name.endsWith('.csv')) {
      toast({ variant: 'destructive', title: 'Invalid file type', description: 'Please upload a CSV file.' });
      return;
    }

    setUploading(true);
    try {
      const text = await file.text();
      
      const { data, error } = await supabase.functions.invoke('process-csv', {
        body: { 
          filename: file.name,
          csvContent: text,
          sourceType,
        },
      });

      if (error) throw error;

      const desc = sourceType === 'credit_card' && data.linkedToPayment
        ? `Linked ${data.processedCount} transactions to bank payment. ${data.duplicateCount} duplicates skipped.`
        : `Processed ${data.processedCount} transactions, ${data.duplicateCount} duplicates skipped.`;

      toast({ title: 'Upload successful', description: desc });
      fetchUploads();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({ variant: 'destructive', title: 'Upload failed', description: 'Please try again.' });
    } finally {
      setUploading(false);
    }
  }, [user, session, toast, sourceType]);

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

        {/* Source Type Selector */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Label className="text-base font-medium">Statement Type</Label>
              <p className="text-sm text-muted-foreground mb-3">
                Select the type of statement you're uploading
              </p>
              <div className="grid grid-cols-2 gap-4 max-w-md">
                <button
                  onClick={() => setSourceType('bank')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                    sourceType === 'bank'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Building2 className={`h-6 w-6 ${sourceType === 'bank' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={`text-sm font-medium ${sourceType === 'bank' ? 'text-primary' : ''}`}>Bank Account</span>
                  <span className="text-xs text-muted-foreground text-center">Main cash flow</span>
                </button>
                <button
                  onClick={() => setSourceType('credit_card')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                    sourceType === 'credit_card'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <CreditCard className={`h-6 w-6 ${sourceType === 'credit_card' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={`text-sm font-medium ${sourceType === 'credit_card' ? 'text-primary' : ''}`}>Credit Card</span>
                  <span className="text-xs text-muted-foreground text-center">Expense detail</span>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upload Area */}
        <Card className="mb-8">
          <CardContent className="pt-6">
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
                  <p className="text-lg font-medium">Processing your {sourceType === 'credit_card' ? 'credit card' : 'bank'} statement...</p>
                  <p className="text-sm text-muted-foreground mt-1">This may take a moment</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="p-4 rounded-full bg-primary/10 mb-4">
                    {sourceType === 'credit_card' 
                      ? <CreditCard className="h-10 w-10 text-primary" />
                      : <UploadIcon className="h-10 w-10 text-primary" />
                    }
                  </div>
                  <p className="text-lg font-medium">Drop your {sourceType === 'credit_card' ? 'credit card' : 'bank'} CSV here</p>
                  <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                  {sourceType === 'credit_card' && (
                    <p className="text-xs text-muted-foreground mt-4">
                      Credit card transactions will be auto-linked to the matching bank payment
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* CSV Format Guide */}
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

        {/* Upload History */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Upload History</CardTitle>
              <CardDescription>Recent statement uploads and their status</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={fetchUploads} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : uploads.length === 0 ? (
              <EmptyState
                icon={<FileSpreadsheet className="h-12 w-12" />}
                title="No uploads yet"
                description="Upload your first bank statement to get started"
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
