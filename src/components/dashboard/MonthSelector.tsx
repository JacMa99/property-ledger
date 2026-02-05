 import { 
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from '@/components/ui/select';
 import { getMonthOptions } from '@/lib/constants';
 
 interface MonthSelectorProps {
   value: string;
   onChange: (value: string) => void;
 }
 
 export function MonthSelector({ value, onChange }: MonthSelectorProps) {
   const months = getMonthOptions();
 
   return (
     <Select value={value} onValueChange={onChange}>
       <SelectTrigger className="w-[200px]">
         <SelectValue placeholder="Select month" />
       </SelectTrigger>
       <SelectContent>
         {months.map((month) => (
           <SelectItem key={month.value} value={month.value}>
             {month.label}
           </SelectItem>
         ))}
       </SelectContent>
     </Select>
   );
 }