 import { CATEGORY_CONFIG } from '@/lib/constants';
 import { cn } from '@/lib/utils';
 
 interface CategoryBadgeProps {
   category: string;
   className?: string;
 }
 
 export function CategoryBadge({ category, className }: CategoryBadgeProps) {
   const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.uncategorized;
   
   return (
     <span className={cn(config.color, className)}>
       {config.label}
     </span>
   );
 }