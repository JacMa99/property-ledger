 import { cn } from '@/lib/utils';
 import { formatCurrency } from '@/lib/constants';
 
 interface MoneyAmountProps {
   amount: number;
   showSign?: boolean;
   className?: string;
 }
 
 export function MoneyAmount({ amount, showSign = true, className }: MoneyAmountProps) {
   const isPositive = amount > 0;
   const isNegative = amount < 0;
   
   return (
     <span 
       className={cn(
         'tabular-nums',
         isPositive && 'money-positive',
         isNegative && 'money-negative',
         !isPositive && !isNegative && 'money-neutral',
         className
       )}
     >
       {showSign && isPositive && '+'}
       {formatCurrency(amount)}
     </span>
   );
 }