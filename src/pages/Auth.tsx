 import { useState, useEffect } from 'react';
 import { useNavigate, useLocation } from 'react-router-dom';
 import { useAuth } from '@/hooks/useAuth';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Building2, Loader2, Eye, EyeOff } from 'lucide-react';
 import { useToast } from '@/hooks/use-toast';
 import { z } from 'zod';
 
 const authSchema = z.object({
   email: z.string().email('Please enter a valid email address'),
   password: z.string().min(6, 'Password must be at least 6 characters'),
   fullName: z.string().min(2, 'Name must be at least 2 characters').optional(),
 });
 
 export default function Auth() {
   const [isLogin, setIsLogin] = useState(true);
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [fullName, setFullName] = useState('');
   const [showPassword, setShowPassword] = useState(false);
   const [loading, setLoading] = useState(false);
   const [errors, setErrors] = useState<{ email?: string; password?: string; fullName?: string }>({});
 
   const { user, signIn, signUp } = useAuth();
   const navigate = useNavigate();
   const location = useLocation();
   const { toast } = useToast();
 
   const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';
 
   useEffect(() => {
     if (user) {
       navigate(from, { replace: true });
     }
   }, [user, navigate, from]);
 
   const validateForm = () => {
     try {
       if (isLogin) {
         authSchema.pick({ email: true, password: true }).parse({ email, password });
       } else {
         authSchema.parse({ email, password, fullName: fullName || undefined });
       }
       setErrors({});
       return true;
     } catch (error) {
       if (error instanceof z.ZodError) {
         const fieldErrors: typeof errors = {};
         error.errors.forEach((err) => {
           const field = err.path[0] as keyof typeof errors;
           fieldErrors[field] = err.message;
         });
         setErrors(fieldErrors);
       }
       return false;
     }
   };
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     
     if (!validateForm()) return;
     
     setLoading(true);
 
     try {
       if (isLogin) {
         const { error } = await signIn(email, password);
         if (error) {
           if (error.message.includes('Invalid login credentials')) {
             toast({
               variant: 'destructive',
               title: 'Invalid credentials',
               description: 'Please check your email and password and try again.',
             });
           } else if (error.message.includes('Email not confirmed')) {
             toast({
               variant: 'destructive',
               title: 'Email not verified',
               description: 'Please check your email and click the verification link.',
             });
           } else {
             toast({
               variant: 'destructive',
               title: 'Login failed',
               description: error.message,
             });
           }
         }
       } else {
         const { error } = await signUp(email, password, fullName);
         if (error) {
           if (error.message.includes('already registered')) {
             toast({
               variant: 'destructive',
               title: 'Email already registered',
               description: 'Please sign in instead or use a different email.',
             });
           } else {
             toast({
               variant: 'destructive',
               title: 'Registration failed',
               description: error.message,
             });
           }
         } else {
           toast({
             title: 'Check your email',
             description: 'We sent you a verification link. Please check your inbox.',
           });
         }
       }
     } finally {
       setLoading(false);
     }
   };
 
   return (
     <div className="min-h-screen flex items-center justify-center bg-background px-4">
       <div className="w-full max-w-md animate-fade-in">
         {/* Logo */}
         <div className="flex justify-center mb-8">
           <div className="flex items-center">
             <div className="p-3 rounded-xl gradient-primary">
               <Building2 className="h-8 w-8 text-primary-foreground" />
             </div>
             <span className="ml-3 text-2xl font-bold text-foreground">PropertyFlow</span>
           </div>
         </div>
 
         <Card className="shadow-elevated">
           <CardHeader className="space-y-1 text-center">
             <CardTitle className="text-2xl font-bold">
               {isLogin ? 'Welcome back' : 'Create an account'}
             </CardTitle>
             <CardDescription>
               {isLogin
                 ? 'Enter your credentials to access your account'
                 : 'Enter your details to get started'}
             </CardDescription>
           </CardHeader>
           <CardContent>
             <form onSubmit={handleSubmit} className="space-y-4">
               {!isLogin && (
                 <div className="space-y-2">
                   <Label htmlFor="fullName">Full Name</Label>
                   <Input
                     id="fullName"
                     type="text"
                     placeholder="John Doe"
                     value={fullName}
                     onChange={(e) => setFullName(e.target.value)}
                     className={errors.fullName ? 'border-destructive' : ''}
                   />
                   {errors.fullName && (
                     <p className="text-sm text-destructive">{errors.fullName}</p>
                   )}
                 </div>
               )}
               
               <div className="space-y-2">
                 <Label htmlFor="email">Email</Label>
                 <Input
                   id="email"
                   type="email"
                   placeholder="you@example.com"
                   value={email}
                   onChange={(e) => setEmail(e.target.value)}
                   className={errors.email ? 'border-destructive' : ''}
                 />
                 {errors.email && (
                   <p className="text-sm text-destructive">{errors.email}</p>
                 )}
               </div>
 
               <div className="space-y-2">
                 <Label htmlFor="password">Password</Label>
                 <div className="relative">
                   <Input
                     id="password"
                     type={showPassword ? 'text' : 'password'}
                     placeholder="••••••••"
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                     className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
                   />
                   <button
                     type="button"
                     onClick={() => setShowPassword(!showPassword)}
                     className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                   >
                     {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                   </button>
                 </div>
                 {errors.password && (
                   <p className="text-sm text-destructive">{errors.password}</p>
                 )}
               </div>
 
               <Button type="submit" className="w-full" disabled={loading}>
                 {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                 {isLogin ? 'Sign In' : 'Create Account'}
               </Button>
             </form>
 
             <div className="mt-6 text-center">
               <button
                 type="button"
                 onClick={() => {
                   setIsLogin(!isLogin);
                   setErrors({});
                 }}
                 className="text-sm text-muted-foreground hover:text-foreground transition-colors"
               >
                 {isLogin ? (
                   <>
                     Don't have an account?{' '}
                     <span className="font-medium text-primary">Sign up</span>
                   </>
                 ) : (
                   <>
                     Already have an account?{' '}
                     <span className="font-medium text-primary">Sign in</span>
                   </>
                 )}
               </button>
             </div>
           </CardContent>
         </Card>
 
         <p className="mt-6 text-center text-sm text-muted-foreground">
           Property management made simple. Track rent, expenses, and generate P&L reports.
         </p>
       </div>
     </div>
   );
 }