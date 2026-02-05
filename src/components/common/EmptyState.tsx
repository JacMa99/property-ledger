 import { ReactNode } from 'react';
 import { Button } from '@/components/ui/button';
 import { cn } from '@/lib/utils';
 
 interface EmptyStateProps {
   icon?: ReactNode;
   title: string;
   description?: string;
   action?: {
     label: string;
     onClick: () => void;
   };
   className?: string;
 }
 
 export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
   return (
     <div className={cn('empty-state', className)}>
       {icon && <div className="empty-state-icon">{icon}</div>}
       <h3 className="empty-state-title">{title}</h3>
       {description && <p className="empty-state-description">{description}</p>}
       {action && (
         <Button onClick={action.onClick} className="mt-4">
           {action.label}
         </Button>
       )}
     </div>
   );
 }