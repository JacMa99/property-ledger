-- Transaction category enum
CREATE TYPE public.transaction_category AS ENUM (
  'rent_income',
  'other_income',
  'mortgage',
  'property_tax',
  'insurance',
  'utilities',
  'maintenance',
  'management_fee',
  'hoa_fee',
  'legal',
  'advertising',
  'supplies',
  'travel',
  'transfer',
  'uncategorized'
);

-- Rule match type enum
CREATE TYPE public.rule_match_type AS ENUM ('contains', 'regex');

-- Statement upload status enum
CREATE TYPE public.statement_upload_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Properties table
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Units table
CREATE TABLE public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,
  monthly_rent DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tenants table
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  lease_start DATE,
  lease_end DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Statement uploads table
CREATE TABLE public.statement_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  filename TEXT NOT NULL,
  status public.statement_upload_status NOT NULL DEFAULT 'pending',
  row_count INTEGER DEFAULT 0,
  processed_count INTEGER DEFAULT 0,
  duplicate_count INTEGER DEFAULT 0,
  error_message TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  category public.transaction_category NOT NULL DEFAULT 'uncategorized',
  subcategory TEXT,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  statement_upload_id UUID REFERENCES public.statement_uploads(id) ON DELETE SET NULL,
  needs_review BOOLEAN NOT NULL DEFAULT false,
  hash TEXT NOT NULL,
  raw_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rent allocations table
CREATE TABLE public.rent_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE NOT NULL,
  unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE NOT NULL,
  month_applied_to TEXT NOT NULL,
  amount_applied DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rules table
CREATE TABLE public.rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  match_type public.rule_match_type NOT NULL DEFAULT 'contains',
  pattern TEXT NOT NULL,
  category public.transaction_category NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transaction notes table
CREATE TABLE public.transaction_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_date ON public.transactions(date);
CREATE INDEX idx_transactions_category ON public.transactions(category);
CREATE INDEX idx_transactions_property_id ON public.transactions(property_id);
CREATE INDEX idx_transactions_hash ON public.transactions(hash);
CREATE INDEX idx_transactions_needs_review ON public.transactions(needs_review) WHERE needs_review = true;
CREATE UNIQUE INDEX idx_transactions_user_hash ON public.transactions(user_id, hash);
CREATE INDEX idx_rent_allocations_unit_id ON public.rent_allocations(unit_id);
CREATE INDEX idx_rent_allocations_month ON public.rent_allocations(month_applied_to);
CREATE INDEX idx_rules_user_priority ON public.rules(user_id, priority DESC);
CREATE INDEX idx_properties_user_id ON public.properties(user_id);
CREATE INDEX idx_units_property_id ON public.units(property_id);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rent_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_notes ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Properties policies
CREATE POLICY "Users can view own properties" ON public.properties FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own properties" ON public.properties FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own properties" ON public.properties FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own properties" ON public.properties FOR DELETE USING (auth.uid() = user_id);

-- Units policies (through property ownership)
CREATE POLICY "Users can view units of own properties" ON public.units FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.properties WHERE id = units.property_id AND user_id = auth.uid()));
CREATE POLICY "Users can insert units to own properties" ON public.units FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.properties WHERE id = units.property_id AND user_id = auth.uid()));
CREATE POLICY "Users can update units of own properties" ON public.units FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.properties WHERE id = units.property_id AND user_id = auth.uid()));
CREATE POLICY "Users can delete units of own properties" ON public.units FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.properties WHERE id = units.property_id AND user_id = auth.uid()));

-- Tenants policies (through unit/property ownership)
CREATE POLICY "Users can view tenants of own units" ON public.tenants FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.units u 
    JOIN public.properties p ON u.property_id = p.id 
    WHERE u.id = tenants.unit_id AND p.user_id = auth.uid()
  ));
CREATE POLICY "Users can insert tenants to own units" ON public.tenants FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.units u 
    JOIN public.properties p ON u.property_id = p.id 
    WHERE u.id = tenants.unit_id AND p.user_id = auth.uid()
  ));
CREATE POLICY "Users can update tenants of own units" ON public.tenants FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM public.units u 
    JOIN public.properties p ON u.property_id = p.id 
    WHERE u.id = tenants.unit_id AND p.user_id = auth.uid()
  ));
CREATE POLICY "Users can delete tenants of own units" ON public.tenants FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM public.units u 
    JOIN public.properties p ON u.property_id = p.id 
    WHERE u.id = tenants.unit_id AND p.user_id = auth.uid()
  ));

-- Statement uploads policies
CREATE POLICY "Users can view own uploads" ON public.statement_uploads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own uploads" ON public.statement_uploads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own uploads" ON public.statement_uploads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own uploads" ON public.statement_uploads FOR DELETE USING (auth.uid() = user_id);

-- Transactions policies
CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON public.transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON public.transactions FOR DELETE USING (auth.uid() = user_id);

-- Rent allocations policies (through transaction ownership)
CREATE POLICY "Users can view own rent allocations" ON public.rent_allocations FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.transactions WHERE id = rent_allocations.transaction_id AND user_id = auth.uid()));
CREATE POLICY "Users can insert own rent allocations" ON public.rent_allocations FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.transactions WHERE id = rent_allocations.transaction_id AND user_id = auth.uid()));
CREATE POLICY "Users can update own rent allocations" ON public.rent_allocations FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.transactions WHERE id = rent_allocations.transaction_id AND user_id = auth.uid()));
CREATE POLICY "Users can delete own rent allocations" ON public.rent_allocations FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.transactions WHERE id = rent_allocations.transaction_id AND user_id = auth.uid()));

-- Rules policies
CREATE POLICY "Users can view own rules" ON public.rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own rules" ON public.rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own rules" ON public.rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own rules" ON public.rules FOR DELETE USING (auth.uid() = user_id);

-- Transaction notes policies
CREATE POLICY "Users can view own transaction notes" ON public.transaction_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transaction notes" ON public.transaction_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own transaction notes" ON public.transaction_notes FOR DELETE USING (auth.uid() = user_id);

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for auto-creating profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_rent_allocations_updated_at BEFORE UPDATE ON public.rent_allocations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_rules_updated_at BEFORE UPDATE ON public.rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();