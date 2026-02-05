import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { MonthSelector } from '@/components/dashboard/MonthSelector';
import { EmptyState } from '@/components/common/EmptyState';
import { CategoryBadge } from '@/components/common/CategoryBadge';
import { MoneyAmount } from '@/components/common/MoneyAmount';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getCurrentMonth, formatCurrency, formatDate, CATEGORY_CONFIG } from '@/lib/constants';
import { 
  TrendingUp, 
  TrendingDown, 
  Building2, 
  AlertCircle,
  ArrowRight,
  Upload,
  Plus
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DashboardStats {
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  needsReviewCount: number;
  propertyCount: number;
}

interface RecentTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
}

export default function Index() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [stats, setStats] = useState<DashboardStats>({
    totalIncome: 0,
    totalExpenses: 0,
    netIncome: 0,
    needsReviewCount: 0,
    propertyCount: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, selectedMonth]);

  async function fetchDashboardData() {
    if (!user) return;
    
    setLoading(true);
    try {
      const [year, month] = selectedMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

      // Fetch transactions for the month
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('amount, category, needs_review')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate);

      if (txError) throw txError;

      // Calculate stats
      let totalIncome = 0;
      let totalExpenses = 0;
      let needsReviewCount = 0;

      transactions?.forEach((tx) => {
        const amount = parseFloat(tx.amount as string);
        const categoryType = CATEGORY_CONFIG[tx.category]?.type;
        
        if (categoryType === 'income' || amount > 0) {
          totalIncome += Math.abs(amount);
        } else if (categoryType === 'expense' || amount < 0) {
          totalExpenses += Math.abs(amount);
        }
        
        if (tx.needs_review) needsReviewCount++;
      });

      // Fetch property count
      const { count: propertyCount } = await supabase
        .from('properties')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Fetch recent transactions
      const { data: recent, error: recentError } = await supabase
        .from('transactions')
        .select('id, date, description, amount, category')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(5);

      if (recentError) throw recentError;

      setStats({
        totalIncome,
        totalExpenses,
        netIncome: totalIncome - totalExpenses,
        needsReviewCount,
        propertyCount: propertyCount || 0,
      });

      setRecentTransactions(recent?.map(tx => ({
        ...tx,
        amount: parseFloat(tx.amount as string),
      })) || []);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast({
        variant: 'destructive',
        title: 'Error loading dashboard',
        description: 'Please try refreshing the page.',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className="page-container">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-description">Overview of your property finances</p>
          </div>
          <MonthSelector value={selectedMonth} onChange={setSelectedMonth} />
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard
            title="Total Income"
            value={formatCurrency(stats.totalIncome)}
            icon={<TrendingUp className="h-5 w-5" />}
            variant="income"
          />
          <StatCard
            title="Total Expenses"
            value={formatCurrency(stats.totalExpenses)}
            icon={<TrendingDown className="h-5 w-5" />}
            variant="expense"
          />
          <StatCard
            title="Net Income"
            value={formatCurrency(stats.netIncome)}
            subtitle={stats.netIncome >= 0 ? 'Profit' : 'Loss'}
            icon={<TrendingUp className="h-5 w-5" />}
            variant={stats.netIncome >= 0 ? 'income' : 'expense'}
          />
          <StatCard
            title="Needs Review"
            value={stats.needsReviewCount.toString()}
            subtitle="Transactions"
            icon={<AlertCircle className="h-5 w-5" />}
            variant={stats.needsReviewCount > 0 ? 'expense' : 'neutral'}
          />
        </div>

        {/* Quick Actions & Recent Transactions */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Quick Actions */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link to="/upload">
                <Button variant="outline" className="w-full justify-start">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Statement
                </Button>
              </Link>
              <Link to="/properties">
                <Button variant="outline" className="w-full justify-start">
                  <Building2 className="h-4 w-4 mr-2" />
                  Manage Properties
                  <span className="ml-auto text-muted-foreground">{stats.propertyCount}</span>
                </Button>
              </Link>
              <Link to="/transactions?needsReview=true">
                <Button variant="outline" className="w-full justify-start">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Review Transactions
                  {stats.needsReviewCount > 0 && (
                    <span className="ml-auto pill-warning">{stats.needsReviewCount}</span>
                  )}
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Recent Transactions</CardTitle>
              <Link to="/transactions">
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentTransactions.length === 0 ? (
                <EmptyState
                  title="No transactions yet"
                  description="Upload a bank statement to get started"
                  action={{
                    label: 'Upload Statement',
                    onClick: () => window.location.href = '/upload',
                  }}
                />
              ) : (
                <div className="space-y-3">
                  {recentTransactions.map((tx) => (
                    <div 
                      key={tx.id}
                      className="flex items-center justify-between py-2 border-b border-border last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{tx.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">{formatDate(tx.date)}</span>
                          <CategoryBadge category={tx.category} />
                        </div>
                      </div>
                      <MoneyAmount amount={tx.amount} className="font-medium" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
