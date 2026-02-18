import { CategoryBadge } from '@/components/common/CategoryBadge';
import { MoneyAmount } from '@/components/common/MoneyAmount';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { CATEGORY_OPTIONS, formatDate } from '@/lib/constants';
import { TYPE_OPTIONS, getDefaultTypeForCategory } from '@/lib/constants';
import { AlertCircle, CheckCircle2, Copy } from 'lucide-react';

export interface PreviewRow {
  date: string;
  description: string;
  amount: number;
  hash: string;
  isDuplicate: boolean;
  suggestedCategory: string;
  suggestedType: string;
  needsReview: boolean;
  isCCPayment?: boolean;
}

export interface ReviewRow extends PreviewRow {
  category: string;
  type: string;
  included: boolean;
}

interface ImportReviewTableProps {
  rows: ReviewRow[];
  onRowChange: (index: number, updates: Partial<ReviewRow>) => void;
  sourceType: string;
}

export function ImportReviewTable({ rows, onRowChange, sourceType }: ImportReviewTableProps) {
  const includedCount = rows.filter(r => r.included && !r.isDuplicate).length;
  const duplicateCount = rows.filter(r => r.isDuplicate).length;
  const ccPaymentCount = rows.filter(r => r.isCCPayment).length;

  return (
    <div>
      <div className="flex gap-4 mb-4 text-sm">
        <span className="text-muted-foreground">
          <span className="font-medium text-foreground">{includedCount}</span> to import
        </span>
        {duplicateCount > 0 && (
          <span className="text-warning">
            <Copy className="h-3.5 w-3.5 inline mr-1" />
            {duplicateCount} duplicates
          </span>
        )}
        {ccPaymentCount > 0 && (
          <span className="text-info">
            <AlertCircle className="h-3.5 w-3.5 inline mr-1" />
            {ccPaymentCount} CC payment{ccPaymentCount > 1 ? 's' : ''} detected
          </span>
        )}
      </div>

      <div className="bg-card rounded-lg border overflow-hidden max-h-[500px] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[100px]">Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right w-[110px]">Amount</TableHead>
              <TableHead className="w-[180px]">Category</TableHead>
              <TableHead className="w-[140px]">Type</TableHead>
              <TableHead className="w-[80px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow
                key={idx}
                className={`${row.isDuplicate ? 'opacity-40' : ''} ${row.isCCPayment ? 'bg-info/5' : ''}`}
              >
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(row.date)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="truncate max-w-[250px] text-sm">{row.description}</span>
                    {row.isCCPayment && (
                      <span className="text-xs bg-info/10 text-info px-1.5 py-0.5 rounded whitespace-nowrap">
                        {sourceType === 'bank' ? 'CC Payment' : 'Payment Credit'}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <MoneyAmount amount={row.type === 'expense' || row.type === 'cc_payment' ? -Math.abs(row.amount) : Math.abs(row.amount)} />
                </TableCell>
                <TableCell>
                  {row.isDuplicate ? (
                    <span className="text-xs text-muted-foreground">Duplicate</span>
                  ) : (
                    <Select
                      value={row.category}
                      onValueChange={(v) => {
                        const newType = getDefaultTypeForCategory(v);
                        onRowChange(idx, { category: v, type: newType });
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell>
                  {row.isDuplicate ? null : (
                    <Select
                      value={row.type}
                      onValueChange={(v) => onRowChange(idx, { type: v })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TYPE_OPTIONS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell>
                  {row.isDuplicate ? (
                    <Copy className="h-4 w-4 text-warning" />
                  ) : row.needsReview ? (
                    <AlertCircle className="h-4 w-4 text-warning" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
