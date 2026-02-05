 import { ReactNode } from 'react';
 import { cn } from '@/lib/utils';
 
 interface StatCardProps {
   title: string;
   value: string;
   subtitle?: string;
   icon?: ReactNode;
   variant?: 'default' | 'income' | 'expense' | 'neutral';
   className?: string;
 }
 
 export function StatCard({ 
   title, 
   value, 
   subtitle, 
   icon,
   variant = 'default',
   className 
 }: StatCardProps) {
   return (
     <div 
       className={cn(
         variant === 'income' && 'stat-card-income',
         variant === 'expense' && 'stat-card-expense',
         variant === 'neutral' && 'stat-card-neutral',
         variant === 'default' && 'stat-card',
         className
       )}
     >
       <div className="flex items-start justify-between">
         <div>
           <p className="text-sm font-medium text-muted-foreground">{title}</p>
           <p className={cn(
             'mt-1 text-2xl font-bold tabular-nums',
             variant === 'income' && 'text-success',
             variant === 'expense' && 'text-destructive',
             variant === 'neutral' && 'text-info',
             variant === 'default' && 'text-foreground'
           )}>
             {value}
           </p>
           {subtitle && (
             <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
           )}
         </div>
         {icon && (
           <div className={cn(
             'p-2 rounded-lg',
             variant === 'income' && 'bg-success/10 text-success',
             variant === 'expense' && 'bg-destructive/10 text-destructive',
             variant === 'neutral' && 'bg-info/10 text-info',
             variant === 'default' && 'bg-muted text-muted-foreground'
           )}>
             {icon}
           </div>
         )}
       </div>
     </div>
   );
 }