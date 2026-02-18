 // Transaction category display names and colors
export const CATEGORY_CONFIG: Record<string, { label: string; color: string; type: 'income' | 'expense' | 'transfer' }> = {
  rent_income: { label: 'Rent Income', color: 'pill-income', type: 'income' },
  other_income: { label: 'Other Income', color: 'pill-income', type: 'income' },
  mortgage: { label: 'Mortgage', color: 'pill-expense', type: 'expense' },
  property_tax: { label: 'Property Tax', color: 'pill-expense', type: 'expense' },
  insurance: { label: 'Insurance', color: 'pill-expense', type: 'expense' },
  utilities: { label: 'Utilities', color: 'pill-expense', type: 'expense' },
  maintenance: { label: 'Maintenance', color: 'pill-expense', type: 'expense' },
  management_fee: { label: 'Management Fee', color: 'pill-expense', type: 'expense' },
  credit_card_payment: { label: 'Credit Card Payment', color: 'pill-expense', type: 'expense' },
  cash_withdrawal: { label: 'Cash Withdrawal', color: 'pill-expense', type: 'expense' },
  groceries: { label: 'Groceries', color: 'pill-expense', type: 'expense' },
  legal: { label: 'Legal', color: 'pill-expense', type: 'expense' },
  advertising: { label: 'Advertising', color: 'pill-expense', type: 'expense' },
  supplies: { label: 'Supplies', color: 'pill-expense', type: 'expense' },
  transfer: { label: 'Transfer', color: 'pill-transfer', type: 'transfer' },
  uncategorized: { label: 'Uncategorized', color: 'pill-warning', type: 'expense' },
};
 
 export const CATEGORY_OPTIONS = Object.entries(CATEGORY_CONFIG).map(([value, config]) => ({
   value,
   label: config.label,
   type: config.type,
 }));
 
 // Format currency
 export function formatCurrency(amount: number): string {
   return new Intl.NumberFormat('en-US', {
     style: 'currency',
     currency: 'USD',
     minimumFractionDigits: 2,
     maximumFractionDigits: 2,
   }).format(amount);
 }
 
 // Format date
 export function formatDate(date: string | Date): string {
   return new Intl.DateTimeFormat('en-US', {
     year: 'numeric',
     month: 'short',
     day: 'numeric',
   }).format(new Date(date));
 }
 
 // Format month (YYYY-MM to readable)
 export function formatMonth(yearMonth: string): string {
   const [year, month] = yearMonth.split('-');
   const date = new Date(parseInt(year), parseInt(month) - 1);
   return new Intl.DateTimeFormat('en-US', {
     year: 'numeric',
     month: 'long',
   }).format(date);
 }
 
 // Get current month in YYYY-MM format
 export function getCurrentMonth(): string {
   const now = new Date();
   return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
 }
 
 // Get months for selector (last 12 months + next 2)
 export function getMonthOptions(): { value: string; label: string }[] {
   const months: { value: string; label: string }[] = [];
   const now = new Date();
   
   for (let i = -12; i <= 2; i++) {
     const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
     const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
     months.push({
       value,
       label: formatMonth(value),
     });
   }
   
   return months.reverse();
 }