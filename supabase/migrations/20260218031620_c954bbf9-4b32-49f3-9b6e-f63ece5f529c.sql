
-- 1. Create account_type enum
CREATE TYPE public.account_type AS ENUM ('bank', 'credit_card');

-- 2. Create accounts table
CREATE TABLE public.accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  account_type public.account_type NOT NULL,
  institution TEXT,
  last4 TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own accounts" ON public.accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own accounts" ON public.accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own accounts" ON public.accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own accounts" ON public.accounts FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Expand transaction_type enum with transfer and cc_payment
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'transfer';
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'cc_payment';

-- 4. Add new columns to transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id),
  ADD COLUMN IF NOT EXISTS linked_transaction_id UUID REFERENCES public.transactions(id),
  ADD COLUMN IF NOT EXISTS type_overridden BOOLEAN NOT NULL DEFAULT false;

-- 5. Add account_id to statement_uploads for linking imports to accounts
ALTER TABLE public.statement_uploads
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id);
