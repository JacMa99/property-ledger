-- Create transaction type enum
CREATE TYPE public.transaction_type AS ENUM ('income', 'expense');

-- Add type column to transactions table with default 'expense'
ALTER TABLE public.transactions 
ADD COLUMN type public.transaction_type NOT NULL DEFAULT 'expense';

-- Update existing transactions: set type based on amount sign and category
-- Positive amounts or income categories = income, everything else = expense
UPDATE public.transactions SET type = 
  CASE 
    WHEN category IN ('rent_income', 'other_income') OR amount > 0 THEN 'income'::public.transaction_type
    ELSE 'expense'::public.transaction_type
  END;