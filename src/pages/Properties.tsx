 import { useState, useEffect } from 'react';
 import { AppLayout } from '@/components/layout/AppLayout';
 import { EmptyState } from '@/components/common/EmptyState';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
   DialogTrigger,
 } from '@/components/ui/dialog';
 import {
   Accordion,
   AccordionContent,
   AccordionItem,
   AccordionTrigger,
 } from '@/components/ui/accordion';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/hooks/useAuth';
 import { useToast } from '@/hooks/use-toast';
 import { formatCurrency } from '@/lib/constants';
 import { 
   Building2, 
   Plus, 
   Home, 
   Users, 
   Pencil, 
   Trash2,
   Loader2,
   MapPin
 } from 'lucide-react';
 
 interface Property {
   id: string;
   name: string;
   address: string | null;
   city: string | null;
   state: string | null;
   zip: string | null;
   units: Unit[];
 }
 
 interface Unit {
   id: string;
   label: string;
   monthly_rent: number;
   tenants: Tenant[];
 }
 
 interface Tenant {
   id: string;
   name: string;
   email: string | null;
   phone: string | null;
   is_active: boolean;
 }
 
 export default function Properties() {
   const [properties, setProperties] = useState<Property[]>([]);
   const [loading, setLoading] = useState(true);
   const [showPropertyDialog, setShowPropertyDialog] = useState(false);
   const [showUnitDialog, setShowUnitDialog] = useState(false);
   const [showTenantDialog, setShowTenantDialog] = useState(false);
   const [editingProperty, setEditingProperty] = useState<Property | null>(null);
   const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
   const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
   const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
   const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
   const [saving, setSaving] = useState(false);
   
   const { user } = useAuth();
   const { toast } = useToast();
 
   // Form states
   const [propertyForm, setPropertyForm] = useState({ name: '', address: '', city: '', state: '', zip: '' });
   const [unitForm, setUnitForm] = useState({ label: '', monthly_rent: '' });
   const [tenantForm, setTenantForm] = useState({ name: '', email: '', phone: '' });
 
   useEffect(() => {
     if (user) fetchProperties();
   }, [user]);
 
   async function fetchProperties() {
     if (!user) return;
     setLoading(true);
     try {
       const { data, error } = await supabase
         .from('properties')
         .select(`
           id, name, address, city, state, zip,
           units (
             id, label, monthly_rent,
             tenants (id, name, email, phone, is_active)
           )
         `)
         .eq('user_id', user.id)
         .order('name');
 
       if (error) throw error;
       
       setProperties(data?.map(p => ({
         ...p,
         units: p.units?.map(u => ({
           ...u,
           monthly_rent: typeof u.monthly_rent === 'string' ? parseFloat(u.monthly_rent) : Number(u.monthly_rent),
           tenants: u.tenants || []
         })) || []
       })) || []);
     } catch (error) {
       console.error('Error fetching properties:', error);
       toast({ variant: 'destructive', title: 'Error loading properties' });
     } finally {
       setLoading(false);
     }
   }
 
   async function saveProperty() {
     if (!user || !propertyForm.name.trim()) return;
     setSaving(true);
     try {
       if (editingProperty) {
         const { error } = await supabase
           .from('properties')
           .update({ 
             name: propertyForm.name,
             address: propertyForm.address || null,
             city: propertyForm.city || null,
             state: propertyForm.state || null,
             zip: propertyForm.zip || null,
           })
           .eq('id', editingProperty.id);
         if (error) throw error;
         toast({ title: 'Property updated' });
       } else {
         const { error } = await supabase
           .from('properties')
           .insert({
             user_id: user.id,
             name: propertyForm.name,
             address: propertyForm.address || null,
             city: propertyForm.city || null,
             state: propertyForm.state || null,
             zip: propertyForm.zip || null,
           });
         if (error) throw error;
         toast({ title: 'Property created' });
       }
       setShowPropertyDialog(false);
       setEditingProperty(null);
       setPropertyForm({ name: '', address: '', city: '', state: '', zip: '' });
       fetchProperties();
     } catch (error) {
       console.error('Error saving property:', error);
       toast({ variant: 'destructive', title: 'Error saving property' });
     } finally {
       setSaving(false);
     }
   }
 
   async function deleteProperty(id: string) {
     if (!confirm('Delete this property and all its units? This cannot be undone.')) return;
     try {
       const { error } = await supabase.from('properties').delete().eq('id', id);
       if (error) throw error;
       toast({ title: 'Property deleted' });
       fetchProperties();
     } catch (error) {
       console.error('Error deleting property:', error);
       toast({ variant: 'destructive', title: 'Error deleting property' });
     }
   }
 
   async function saveUnit() {
     if (!selectedPropertyId || !unitForm.label.trim()) return;
     setSaving(true);
     try {
       const rentValue = parseFloat(unitForm.monthly_rent) || 0;
       if (editingUnit) {
         const { error } = await supabase
           .from('units')
           .update({ label: unitForm.label, monthly_rent: rentValue })
           .eq('id', editingUnit.id);
         if (error) throw error;
         toast({ title: 'Unit updated' });
       } else {
         const { error } = await supabase
           .from('units')
           .insert({ property_id: selectedPropertyId, label: unitForm.label, monthly_rent: rentValue });
         if (error) throw error;
         toast({ title: 'Unit created' });
       }
       setShowUnitDialog(false);
       setEditingUnit(null);
       setUnitForm({ label: '', monthly_rent: '' });
       fetchProperties();
     } catch (error) {
       console.error('Error saving unit:', error);
       toast({ variant: 'destructive', title: 'Error saving unit' });
     } finally {
       setSaving(false);
     }
   }
 
   async function deleteUnit(id: string) {
     if (!confirm('Delete this unit and all its tenants?')) return;
     try {
       const { error } = await supabase.from('units').delete().eq('id', id);
       if (error) throw error;
       toast({ title: 'Unit deleted' });
       fetchProperties();
     } catch (error) {
       console.error('Error deleting unit:', error);
       toast({ variant: 'destructive', title: 'Error deleting unit' });
     }
   }
 
   async function saveTenant() {
     if (!selectedUnitId || !tenantForm.name.trim()) return;
     setSaving(true);
     try {
       if (editingTenant) {
         const { error } = await supabase
           .from('tenants')
           .update({ name: tenantForm.name, email: tenantForm.email || null, phone: tenantForm.phone || null })
           .eq('id', editingTenant.id);
         if (error) throw error;
         toast({ title: 'Tenant updated' });
       } else {
         const { error } = await supabase
           .from('tenants')
           .insert({ unit_id: selectedUnitId, name: tenantForm.name, email: tenantForm.email || null, phone: tenantForm.phone || null });
         if (error) throw error;
         toast({ title: 'Tenant added' });
       }
       setShowTenantDialog(false);
       setEditingTenant(null);
       setTenantForm({ name: '', email: '', phone: '' });
       fetchProperties();
     } catch (error) {
       console.error('Error saving tenant:', error);
       toast({ variant: 'destructive', title: 'Error saving tenant' });
     } finally {
       setSaving(false);
     }
   }
 
   async function deleteTenant(id: string) {
     if (!confirm('Remove this tenant?')) return;
     try {
       const { error } = await supabase.from('tenants').delete().eq('id', id);
       if (error) throw error;
       toast({ title: 'Tenant removed' });
       fetchProperties();
     } catch (error) {
       console.error('Error deleting tenant:', error);
       toast({ variant: 'destructive', title: 'Error deleting tenant' });
     }
   }
 
   function openPropertyDialog(property?: Property) {
     if (property) {
       setEditingProperty(property);
       setPropertyForm({
         name: property.name,
         address: property.address || '',
         city: property.city || '',
         state: property.state || '',
         zip: property.zip || '',
       });
     } else {
       setEditingProperty(null);
       setPropertyForm({ name: '', address: '', city: '', state: '', zip: '' });
     }
     setShowPropertyDialog(true);
   }
 
   function openUnitDialog(propertyId: string, unit?: Unit) {
     setSelectedPropertyId(propertyId);
     if (unit) {
       setEditingUnit(unit);
       setUnitForm({ label: unit.label, monthly_rent: unit.monthly_rent.toString() });
     } else {
       setEditingUnit(null);
       setUnitForm({ label: '', monthly_rent: '' });
     }
     setShowUnitDialog(true);
   }
 
   function openTenantDialog(unitId: string, tenant?: Tenant) {
     setSelectedUnitId(unitId);
     if (tenant) {
       setEditingTenant(tenant);
       setTenantForm({ name: tenant.name, email: tenant.email || '', phone: tenant.phone || '' });
     } else {
       setEditingTenant(null);
       setTenantForm({ name: '', email: '', phone: '' });
     }
     setShowTenantDialog(true);
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
         <div className="flex items-center justify-between mb-8">
           <div>
             <h1 className="page-title">Properties</h1>
             <p className="page-description">Manage your properties, units, and tenants</p>
           </div>
           <Button onClick={() => openPropertyDialog()}>
             <Plus className="h-4 w-4 mr-2" />
             Add Property
           </Button>
         </div>
 
         {properties.length === 0 ? (
           <EmptyState
             icon={<Building2 className="h-12 w-12" />}
             title="No properties yet"
             description="Add your first property to start tracking rent and expenses"
             action={{ label: 'Add Property', onClick: () => openPropertyDialog() }}
           />
         ) : (
           <div className="space-y-4">
             {properties.map((property) => (
               <Card key={property.id} className="overflow-hidden">
                 <CardHeader className="bg-muted/30">
                   <div className="flex items-start justify-between">
                     <div>
                       <CardTitle className="flex items-center gap-2">
                         <Building2 className="h-5 w-5 text-primary" />
                         {property.name}
                       </CardTitle>
                       {(property.address || property.city) && (
                         <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                           <MapPin className="h-3 w-3" />
                           {[property.address, property.city, property.state, property.zip].filter(Boolean).join(', ')}
                         </p>
                       )}
                     </div>
                     <div className="flex gap-2">
                       <Button variant="ghost" size="icon" onClick={() => openPropertyDialog(property)}>
                         <Pencil className="h-4 w-4" />
                       </Button>
                       <Button variant="ghost" size="icon" onClick={() => deleteProperty(property.id)}>
                         <Trash2 className="h-4 w-4 text-destructive" />
                       </Button>
                     </div>
                   </div>
                 </CardHeader>
                 <CardContent className="pt-4">
                   <div className="flex items-center justify-between mb-3">
                     <h4 className="text-sm font-medium flex items-center gap-2">
                       <Home className="h-4 w-4" />
                       Units ({property.units.length})
                     </h4>
                     <Button variant="outline" size="sm" onClick={() => openUnitDialog(property.id)}>
                       <Plus className="h-3 w-3 mr-1" />
                       Add Unit
                     </Button>
                   </div>
                   
                   {property.units.length === 0 ? (
                     <p className="text-sm text-muted-foreground py-4 text-center">No units yet</p>
                   ) : (
                     <Accordion type="multiple" className="w-full">
                       {property.units.map((unit) => (
                         <AccordionItem key={unit.id} value={unit.id}>
                           <AccordionTrigger className="hover:no-underline">
                             <div className="flex items-center justify-between w-full pr-4">
                               <span className="font-medium">{unit.label}</span>
                               <span className="text-sm text-muted-foreground">{formatCurrency(unit.monthly_rent)}/mo</span>
                             </div>
                           </AccordionTrigger>
                           <AccordionContent>
                             <div className="pl-4 border-l-2 border-muted ml-2">
                               <div className="flex items-center justify-between mb-2">
                                 <div className="flex gap-2">
                                   <Button variant="ghost" size="sm" onClick={() => openUnitDialog(property.id, unit)}>
                                     <Pencil className="h-3 w-3 mr-1" />
                                     Edit
                                   </Button>
                                   <Button variant="ghost" size="sm" onClick={() => deleteUnit(unit.id)}>
                                     <Trash2 className="h-3 w-3 mr-1 text-destructive" />
                                     Delete
                                   </Button>
                                 </div>
                                 <Button variant="outline" size="sm" onClick={() => openTenantDialog(unit.id)}>
                                   <Users className="h-3 w-3 mr-1" />
                                   Add Tenant
                                 </Button>
                               </div>
                               
                               {unit.tenants.length === 0 ? (
                                 <p className="text-sm text-muted-foreground py-2">No tenants</p>
                               ) : (
                                 <div className="space-y-2">
                                   {unit.tenants.map((tenant) => (
                                     <div key={tenant.id} className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg">
                                       <div>
                                         <p className="font-medium text-sm">{tenant.name}</p>
                                         {tenant.email && <p className="text-xs text-muted-foreground">{tenant.email}</p>}
                                       </div>
                                       <div className="flex items-center gap-2">
                                         <span className={tenant.is_active ? 'pill-income' : 'pill-neutral'}>
                                           {tenant.is_active ? 'Active' : 'Inactive'}
                                         </span>
                                         <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openTenantDialog(unit.id, tenant)}>
                                           <Pencil className="h-3 w-3" />
                                         </Button>
                                         <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteTenant(tenant.id)}>
                                           <Trash2 className="h-3 w-3 text-destructive" />
                                         </Button>
                                       </div>
                                     </div>
                                   ))}
                                 </div>
                               )}
                             </div>
                           </AccordionContent>
                         </AccordionItem>
                       ))}
                     </Accordion>
                   )}
                 </CardContent>
               </Card>
             ))}
           </div>
         )}
 
         {/* Property Dialog */}
         <Dialog open={showPropertyDialog} onOpenChange={setShowPropertyDialog}>
           <DialogContent>
             <DialogHeader>
               <DialogTitle>{editingProperty ? 'Edit Property' : 'Add Property'}</DialogTitle>
               <DialogDescription>Enter the property details below.</DialogDescription>
             </DialogHeader>
             <div className="space-y-4 py-4">
               <div className="space-y-2">
                 <Label htmlFor="name">Property Name *</Label>
                 <Input id="name" value={propertyForm.name} onChange={(e) => setPropertyForm({ ...propertyForm, name: e.target.value })} placeholder="e.g., Maple Street Duplex" />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="address">Address</Label>
                 <Input id="address" value={propertyForm.address} onChange={(e) => setPropertyForm({ ...propertyForm, address: e.target.value })} placeholder="123 Main St" />
               </div>
               <div className="grid grid-cols-3 gap-2">
                 <div className="space-y-2">
                   <Label htmlFor="city">City</Label>
                   <Input id="city" value={propertyForm.city} onChange={(e) => setPropertyForm({ ...propertyForm, city: e.target.value })} />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="state">State</Label>
                   <Input id="state" value={propertyForm.state} onChange={(e) => setPropertyForm({ ...propertyForm, state: e.target.value })} />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="zip">ZIP</Label>
                   <Input id="zip" value={propertyForm.zip} onChange={(e) => setPropertyForm({ ...propertyForm, zip: e.target.value })} />
                 </div>
               </div>
             </div>
             <DialogFooter>
               <Button variant="outline" onClick={() => setShowPropertyDialog(false)}>Cancel</Button>
               <Button onClick={saveProperty} disabled={saving || !propertyForm.name.trim()}>
                 {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                 {editingProperty ? 'Save Changes' : 'Add Property'}
               </Button>
             </DialogFooter>
           </DialogContent>
         </Dialog>
 
         {/* Unit Dialog */}
         <Dialog open={showUnitDialog} onOpenChange={setShowUnitDialog}>
           <DialogContent>
             <DialogHeader>
               <DialogTitle>{editingUnit ? 'Edit Unit' : 'Add Unit'}</DialogTitle>
               <DialogDescription>Enter the unit details below.</DialogDescription>
             </DialogHeader>
             <div className="space-y-4 py-4">
               <div className="space-y-2">
                 <Label htmlFor="label">Unit Label *</Label>
                 <Input id="label" value={unitForm.label} onChange={(e) => setUnitForm({ ...unitForm, label: e.target.value })} placeholder="e.g., Unit A, Apt 101" />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="rent">Monthly Rent ($)</Label>
                 <Input id="rent" type="number" step="0.01" value={unitForm.monthly_rent} onChange={(e) => setUnitForm({ ...unitForm, monthly_rent: e.target.value })} placeholder="1500.00" />
               </div>
             </div>
             <DialogFooter>
               <Button variant="outline" onClick={() => setShowUnitDialog(false)}>Cancel</Button>
               <Button onClick={saveUnit} disabled={saving || !unitForm.label.trim()}>
                 {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                 {editingUnit ? 'Save Changes' : 'Add Unit'}
               </Button>
             </DialogFooter>
           </DialogContent>
         </Dialog>
 
         {/* Tenant Dialog */}
         <Dialog open={showTenantDialog} onOpenChange={setShowTenantDialog}>
           <DialogContent>
             <DialogHeader>
               <DialogTitle>{editingTenant ? 'Edit Tenant' : 'Add Tenant'}</DialogTitle>
               <DialogDescription>Enter the tenant details below.</DialogDescription>
             </DialogHeader>
             <div className="space-y-4 py-4">
               <div className="space-y-2">
                 <Label htmlFor="tenantName">Name *</Label>
                 <Input id="tenantName" value={tenantForm.name} onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })} placeholder="John Doe" />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="tenantEmail">Email</Label>
                 <Input id="tenantEmail" type="email" value={tenantForm.email} onChange={(e) => setTenantForm({ ...tenantForm, email: e.target.value })} placeholder="john@example.com" />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="tenantPhone">Phone</Label>
                 <Input id="tenantPhone" value={tenantForm.phone} onChange={(e) => setTenantForm({ ...tenantForm, phone: e.target.value })} placeholder="(555) 123-4567" />
               </div>
             </div>
             <DialogFooter>
               <Button variant="outline" onClick={() => setShowTenantDialog(false)}>Cancel</Button>
               <Button onClick={saveTenant} disabled={saving || !tenantForm.name.trim()}>
                 {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                 {editingTenant ? 'Save Changes' : 'Add Tenant'}
               </Button>
             </DialogFooter>
           </DialogContent>
         </Dialog>
       </div>
     </AppLayout>
   );
 }