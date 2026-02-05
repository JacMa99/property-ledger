 import { ReactNode } from 'react';
 import { Link, useLocation, useNavigate } from 'react-router-dom';
 import { 
   LayoutDashboard, 
   Building2, 
   ArrowUpDown, 
   FileText, 
   Settings, 
   Upload, 
   LogOut,
   ListFilter,
   BarChart3,
   Menu,
   X
 } from 'lucide-react';
 import { useAuth } from '@/hooks/useAuth';
 import { Button } from '@/components/ui/button';
 import { useState } from 'react';
 import { cn } from '@/lib/utils';
 
 interface AppLayoutProps {
   children: ReactNode;
 }
 
 const navigation = [
   { name: 'Dashboard', href: '/', icon: LayoutDashboard },
   { name: 'Properties', href: '/properties', icon: Building2 },
   { name: 'Transactions', href: '/transactions', icon: ArrowUpDown },
   { name: 'Upload', href: '/upload', icon: Upload },
   { name: 'Rules', href: '/rules', icon: ListFilter },
   { name: 'Reports', href: '/reports', icon: BarChart3 },
 ];
 
 export function AppLayout({ children }: AppLayoutProps) {
   const { user, signOut } = useAuth();
   const location = useLocation();
   const navigate = useNavigate();
   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
 
   const handleSignOut = async () => {
     await signOut();
     navigate('/auth');
   };
 
   return (
     <div className="min-h-screen flex">
       {/* Desktop Sidebar */}
       <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-sidebar">
         <div className="flex flex-col flex-1 overflow-y-auto">
           {/* Logo */}
           <div className="flex items-center h-16 px-6 border-b border-sidebar-border">
             <Building2 className="h-8 w-8 text-sidebar-primary" />
             <span className="ml-3 text-xl font-bold text-sidebar-foreground">PropertyFlow</span>
           </div>
 
           {/* Navigation */}
           <nav className="flex-1 px-3 py-4 space-y-1">
             {navigation.map((item) => {
               const isActive = location.pathname === item.href;
               return (
                 <Link
                   key={item.name}
                   to={item.href}
                   className={cn(
                     'flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors',
                     isActive
                       ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                       : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                   )}
                 >
                   <item.icon className="h-5 w-5 mr-3" />
                   {item.name}
                 </Link>
               );
             })}
           </nav>
 
           {/* User section */}
           <div className="p-4 border-t border-sidebar-border">
             <div className="flex items-center">
               <div className="flex-1 min-w-0">
                 <p className="text-sm font-medium text-sidebar-foreground truncate">
                   {user?.email}
                 </p>
               </div>
               <Button
                 variant="ghost"
                 size="icon"
                 onClick={handleSignOut}
                 className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
               >
                 <LogOut className="h-5 w-5" />
               </Button>
             </div>
           </div>
         </div>
       </aside>
 
       {/* Mobile header */}
       <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-sidebar h-16 flex items-center justify-between px-4">
         <div className="flex items-center">
           <Building2 className="h-7 w-7 text-sidebar-primary" />
           <span className="ml-2 text-lg font-bold text-sidebar-foreground">PropertyFlow</span>
         </div>
         <Button
           variant="ghost"
           size="icon"
           onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
           className="text-sidebar-foreground"
         >
           {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
         </Button>
       </div>
 
       {/* Mobile menu overlay */}
       {mobileMenuOpen && (
         <div className="lg:hidden fixed inset-0 z-30 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
       )}
 
       {/* Mobile menu */}
       {mobileMenuOpen && (
         <div className="lg:hidden fixed top-16 left-0 right-0 z-40 bg-sidebar border-b border-sidebar-border">
           <nav className="px-4 py-2 space-y-1">
             {navigation.map((item) => {
               const isActive = location.pathname === item.href;
               return (
                 <Link
                   key={item.name}
                   to={item.href}
                   onClick={() => setMobileMenuOpen(false)}
                   className={cn(
                     'flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors',
                     isActive
                       ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                       : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                   )}
                 >
                   <item.icon className="h-5 w-5 mr-3" />
                   {item.name}
                 </Link>
               );
             })}
             <button
               onClick={handleSignOut}
               className="flex items-center w-full px-3 py-2.5 text-sm font-medium rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
             >
               <LogOut className="h-5 w-5 mr-3" />
               Sign Out
             </button>
           </nav>
         </div>
       )}
 
       {/* Main content */}
       <main className="flex-1 lg:pl-64">
         <div className="pt-16 lg:pt-0">
           {children}
         </div>
       </main>
     </div>
   );
 }