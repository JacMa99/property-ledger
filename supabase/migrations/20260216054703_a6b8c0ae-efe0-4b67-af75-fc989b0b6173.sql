
-- Add source_type to statement_uploads
CREATE TYPE public.upload_source_type AS ENUM ('bank', 'credit_card');
ALTER TABLE public.statement_uploads ADD COLUMN source_type public.upload_source_type NOT NULL DEFAULT 'bank';

-- Add parent_transaction_id to transactions for CC child linking
ALTER TABLE public.transactions ADD COLUMN parent_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL;
CREATE INDEX idx_transactions_parent ON public.transactions(parent_transaction_id) WHERE parent_transaction_id IS NOT NULL;

-- Create projects table
CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  budget numeric(12,2),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects" ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.projects FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add project_id to transactions
ALTER TABLE public.transactions ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
CREATE INDEX idx_transactions_project ON public.transactions(project_id) WHERE project_id IS NOT NULL;
