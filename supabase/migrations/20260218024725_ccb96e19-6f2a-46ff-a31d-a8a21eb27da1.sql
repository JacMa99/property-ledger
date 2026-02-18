
-- Add new category enum values
ALTER TYPE public.transaction_category ADD VALUE IF NOT EXISTS 'credit_card_payment';
ALTER TYPE public.transaction_category ADD VALUE IF NOT EXISTS 'cash_withdrawal';
ALTER TYPE public.transaction_category ADD VALUE IF NOT EXISTS 'groceries';

-- Recategorize any existing transactions using removed categories
UPDATE public.transactions SET category = 'uncategorized' WHERE category IN ('hoa_fee', 'travel');

-- Recategorize any rules using removed categories
UPDATE public.rules SET category = 'uncategorized' WHERE category IN ('hoa_fee', 'travel');
