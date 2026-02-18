 import { useState, useEffect, useMemo } from 'react';
 import { AppLayout } from '@/components/layout/AppLayout';
 import { StatCard } from '@/components/dashboard/StatCard';
 import { MonthSelector } from '@/components/dashboard/MonthSelector';
 import { EmptyState } from '@/components/common/EmptyState';
 import { Button } from '@/components/ui/button';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from '@/components/ui/select';
 import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
 } from '@/components/ui/table';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/hooks/useAuth';
 import { useToast } from '@/hooks/use-toast';
 import { getCurrentMonth, formatCurrency, formatMonth, CATEGORY_CONFIG } from '@/lib/constants';
 import { 
   BarChart3, 
   TrendingUp, 
   TrendingDown, 
   Download,
   Loader2,
   Building2
 } from 'lucide-react';
 
 interface Property {
   id: string;
   name: string;
 }
 
 interface TransactionSummary {
   category: string;
   total: number;
 }
 
 interface PropertyPnL {
   property_id: string;
   property_name: string;
   income: number;
   expenses: number;
   net: number;
 }
 
 export default function Reports() {
   const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
   const [selectedProperty, setSelectedProperty] = useState<string>('all');
   const [properties, setProperties] = useState<Property[]>([]);
   const [categoryBreakdown, setCategoryBreakdown] = useState<TransactionSummary[]>([]);
   const [propertyPnL, setPropertyPnL] = useState<PropertyPnL[]>([]);
   const [loading, setLoading] = useState(true);
   
   const { user } = useAuth();
   const { toast } = useToast();
 
   useEffect(() => {
     if (user) {
       fetchProperties();
       fetchReportData();
     }
   }, [user, selectedMonth, selectedProperty]);
 
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
 
   async function fetchReportData() {
     if (!user) return;
     setLoading(true);
     try {
       const [year, month] = selectedMonth.split('-');
       const startDate = `${year}-${month}-01`;
       const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];
 
        // Fetch transactions for the month
         let query = supabase
           .from('transactions')
           .select('amount, category, type, property_id, parent_transaction_id, property:properties(name)')
           .eq('user_id', user.id)
           .gte('date', startDate)
           .lte('date', endDate)
           .is('parent_transaction_id', null);

        if (selectedProperty !== 'all') {
          query = query.eq('property_id', selectedProperty);
        }

        const { data: transactions, error } = await query;
        if (error) throw error;

        // Category breakdown
        const categoryMap: Record<string, number> = {};
        const propertyMap: Record<string, { income: number; expenses: number; name: string }> = {};

        transactions?.forEach((tx) => {
          const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : Number(tx.amount);
          const category = tx.category;
          const txType = (tx as any).type || 'expense';
          
          // Category breakdown: income positive, expense negative
          const signedAmount = txType === 'income' ? Math.abs(amount) : -Math.abs(amount);
          categoryMap[category] = (categoryMap[category] || 0) + signedAmount;

          // Property P&L using explicit type field
          if (tx.property_id) {
            if (!propertyMap[tx.property_id]) {
              propertyMap[tx.property_id] = { 
                income: 0, 
                expenses: 0, 
                name: (tx.property as { name: string } | null)?.name || 'Unknown'
              };
            }
            if (txType === 'income') {
              propertyMap[tx.property_id].income += Math.abs(amount);
            } else if (txType === 'expense') {
              propertyMap[tx.property_id].expenses += Math.abs(amount);
            }
          }
        });
 
       setCategoryBreakdown(
         Object.entries(categoryMap)
           .map(([category, total]) => ({ category, total }))
           .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
       );
 
       setPropertyPnL(
         Object.entries(propertyMap)
           .map(([property_id, data]) => ({
             property_id,
             property_name: data.name,
             income: data.income,
             expenses: data.expenses,
             net: data.income - data.expenses,
           }))
           .sort((a, b) => b.net - a.net)
       );
 
     } catch (error) {
       console.error('Error fetching report data:', error);
       toast({ variant: 'destructive', title: 'Error loading report' });
     } finally {
       setLoading(false);
     }
   }
 
    const totals = useMemo(() => {
      let income = 0;
      let expenses = 0;
      
      categoryBreakdown.forEach(({ category, total }) => {
        const categoryType = CATEGORY_CONFIG[category]?.type;
        if (categoryType === 'income') {
          income += Math.abs(total);
        } else if (categoryType === 'expense') {
          expenses += Math.abs(total);
        }
        // transfers are excluded from totals
      });
      
      return { income, expenses, net: income - expenses };
    }, [categoryBreakdown]);
 
   function exportCSV() {
     const headers = ['Category', 'Amount'];
     const rows = categoryBreakdown.map(({ category, total }) => [
       CATEGORY_CONFIG[category]?.label || category,
       total.toFixed(2),
     ]);
     
     rows.push([]);
     rows.push(['Total Income', totals.income.toFixed(2)]);
     rows.push(['Total Expenses', totals.expenses.toFixed(2)]);
     rows.push(['Net Income', totals.net.toFixed(2)]);
 
     const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
     const blob = new Blob([csv], { type: 'text/csv' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `pnl-report-${selectedMonth}.csv`;
     a.click();
     URL.revokeObjectURL(url);
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
         {/* Header */}
         <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
           <div>
             <h1 className="page-title">P&L Report</h1>
             <p className="page-description">{formatMonth(selectedMonth)}</p>
           </div>
           <div className="flex gap-3">
             <Select value={selectedProperty} onValueChange={setSelectedProperty}>
               <SelectTrigger className="w-[180px]">
                 <SelectValue placeholder="All Properties" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">All Properties</SelectItem>
                 {properties.map((prop) => (
                   <SelectItem key={prop.id} value={prop.id}>{prop.name}</SelectItem>
                 ))}
               </SelectContent>
             </Select>
             <MonthSelector value={selectedMonth} onChange={setSelectedMonth} />
             <Button variant="outline" onClick={exportCSV}>
               <Download className="h-4 w-4 mr-2" />
               Export
             </Button>
           </div>
         </div>
 
         {/* Summary Stats */}
         <div className="grid gap-4 sm:grid-cols-3 mb-8">
           <StatCard
             title="Total Income"
             value={formatCurrency(totals.income)}
             icon={<TrendingUp className="h-5 w-5" />}
             variant="income"
           />
           <StatCard
             title="Total Expenses"
             value={formatCurrency(totals.expenses)}
             icon={<TrendingDown className="h-5 w-5" />}
             variant="expense"
           />
           <StatCard
             title="Net Income"
             value={formatCurrency(totals.net)}
             subtitle={totals.net >= 0 ? 'Profit' : 'Loss'}
             icon={totals.net >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
             variant={totals.net >= 0 ? 'income' : 'expense'}
           />
         </div>
 
         <div className="grid gap-6 lg:grid-cols-2">
           {/* Category Breakdown */}
           <Card>
             <CardHeader>
               <CardTitle className="text-lg">Category Breakdown</CardTitle>
               <CardDescription>Income and expenses by category</CardDescription>
             </CardHeader>
             <CardContent>
               {categoryBreakdown.length === 0 ? (
                 <EmptyState
                   icon={<BarChart3 className="h-12 w-12" />}
                   title="No data"
                   description="No transactions for this period"
                 />
               ) : (
                 <Table>
                   <TableHeader>
                     <TableRow>
                       <TableHead>Category</TableHead>
                       <TableHead className="text-right">Amount</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {categoryBreakdown.map(({ category, total }) => (
                       <TableRow key={category}>
                         <TableCell>{CATEGORY_CONFIG[category]?.label || category}</TableCell>
                         <TableCell className={`text-right tabular-nums ${total > 0 ? 'text-success' : 'text-destructive'}`}>
                           {formatCurrency(total)}
                         </TableCell>
                       </TableRow>
                     ))}
                   </TableBody>
                 </Table>
               )}
             </CardContent>
           </Card>
 
           {/* Property P&L */}
           <Card>
             <CardHeader>
               <CardTitle className="text-lg">Property Performance</CardTitle>
               <CardDescription>P&L by property</CardDescription>
             </CardHeader>
             <CardContent>
               {propertyPnL.length === 0 ? (
                 <EmptyState
                   icon={<Building2 className="h-12 w-12" />}
                   title="No property data"
                   description="Assign transactions to properties to see performance"
                 />
               ) : (
                 <Table>
                   <TableHeader>
                     <TableRow>
                       <TableHead>Property</TableHead>
                       <TableHead className="text-right">Income</TableHead>
                       <TableHead className="text-right">Expenses</TableHead>
                       <TableHead className="text-right">Net</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {propertyPnL.map((pnl) => (
                       <TableRow key={pnl.property_id}>
                         <TableCell className="font-medium">{pnl.property_name}</TableCell>
                         <TableCell className="text-right tabular-nums text-success">
                           {formatCurrency(pnl.income)}
                         </TableCell>
                         <TableCell className="text-right tabular-nums text-destructive">
                           {formatCurrency(pnl.expenses)}
                         </TableCell>
                         <TableCell className={`text-right tabular-nums font-medium ${pnl.net >= 0 ? 'text-success' : 'text-destructive'}`}>
                           {formatCurrency(pnl.net)}
                         </TableCell>
                       </TableRow>
                     ))}
                   </TableBody>
                 </Table>
               )}
             </CardContent>
           </Card>
         </div>
       </div>
     </AppLayout>
   );
 }