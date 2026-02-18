import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface CSVRow {
  date: string;
  description: string;
  amount: number;
}

// Normalize header by removing diacritics and lowercasing
function normalizeHeader(header: string): string {
  if (!header) return "";
  return header
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['"]/g, "");
}

// Flexible date parsing
function parseFlexibleDate(value: string | number | null): string | null {
  if (!value) return null;

  if (typeof value === 'number' && value > 1 && value < 100000) {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  const trimmed = String(value).trim().replace(/['"]/g, '');
  if (!trimmed) return null;

  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const slashMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (slashMatch) {
    let [, first, second, yearStr] = slashMatch;
    let year = parseInt(yearStr, 10);
    if (year < 100) year += year < 50 ? 2000 : 1900;
    
    const firstNum = parseInt(first, 10);
    const secondNum = parseInt(second, 10);
    
    let day: number, month: number;
    if (firstNum > 12) { day = firstNum; month = secondNum; }
    else if (secondNum > 12) { month = firstNum; day = secondNum; }
    else { day = firstNum; month = secondNum; }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  try {
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    }
  } catch { /* ignore */ }

  return null;
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

const DATE_PATTERNS = ['date', 'fecha', 'posted', 'transaction date', 'posting date', 'value date', 'fecha valor', 'fecha operacion'];
const DESC_PATTERNS = ['description', 'descripcion', 'memo', 'payee', 'details', 'detalle', 'concepto', 'narrative', 'reference', 'referencia'];
const AMOUNT_PATTERNS = ['amount', 'monto', 'importe', 'value', 'valor'];
const DEBIT_PATTERNS = ['debit', 'debito', 'withdrawal', 'retiro', 'cargo', 'debits'];
const CREDIT_PATTERNS = ['credit', 'credito', 'deposit', 'deposito', 'abono', 'credits'];

function findColumnIndex(headers: string[], patterns: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const normalized = normalizeHeader(headers[i]);
    for (const pattern of patterns) {
      if (normalized.includes(pattern) || normalized === pattern) return i;
    }
  }
  return -1;
}

function findHeaderRow(lines: string[]): { headerIndex: number; headers: string[] } {
  for (let i = 0; i < Math.min(30, lines.length); i++) {
    const cells = parseCSVLine(lines[i]);
    const dateIdx = findColumnIndex(cells, DATE_PATTERNS);
    const descIdx = findColumnIndex(cells, DESC_PATTERNS);
    if (dateIdx !== -1 && descIdx !== -1) return { headerIndex: i, headers: cells };
  }
  return { headerIndex: -1, headers: [] };
}

function parseCSV(csvContent: string): CSVRow[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return [];

  const { headerIndex, headers } = findHeaderRow(lines);
  if (headerIndex === -1) {
    throw new Error('CSV must have date and description columns.');
  }

  const dateIdx = findColumnIndex(headers, DATE_PATTERNS);
  const descIdx = findColumnIndex(headers, DESC_PATTERNS);
  const amountIdx = findColumnIndex(headers, AMOUNT_PATTERNS);
  const debitIdx = findColumnIndex(headers, DEBIT_PATTERNS);
  const creditIdx = findColumnIndex(headers, CREDIT_PATTERNS);

  const rows: CSVRow[] = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const dateStr = values[dateIdx]?.replace(/"/g, '') || '';
    const description = values[descIdx]?.replace(/"/g, '') || '';

    let amount = 0;
    if (amountIdx !== -1 && values[amountIdx]) {
      amount = parseFloat(values[amountIdx]?.replace(/[^0-9.-]/g, '') || '0');
    } else if (debitIdx !== -1 || creditIdx !== -1) {
      const debit = parseFloat(values[debitIdx]?.replace(/[^0-9.-]/g, '') || '0');
      const credit = parseFloat(values[creditIdx]?.replace(/[^0-9.-]/g, '') || '0');
      amount = credit - debit;
    }

    const date = parseFlexibleDate(dateStr);
    if (!date || !description) continue;
    rows.push({ date, description, amount });
  }
  return rows;
}

// Keyword-based auto-categorization (best-effort, case-insensitive)
const CATEGORY_KEYWORDS: { category: string; keywords: string[] }[] = [
  { category: 'rent_income', keywords: ['rent payment', 'tenant payment', 'lease payment', 'rental income', 'rent deposit'] },
  { category: 'other_income', keywords: ['interest earned', 'dividend', 'refund', 'reimbursement', 'rebate', 'cashback'] },
  { category: 'mortgage', keywords: ['mortgage', 'home loan', 'loan payment'] },
  { category: 'property_tax', keywords: ['property tax', 'real estate tax', 'county tax', 'tax assessment'] },
  { category: 'insurance', keywords: ['insurance', 'homeowner', 'hazard', 'liability', 'policy premium'] },
  { category: 'utilities', keywords: ['electric', 'electricity', 'gas bill', 'water bill', 'sewer', 'trash', 'waste', 'utility', 'power company', 'energy', 'comcast', 'spectrum', 'internet', 'cable'] },
  { category: 'maintenance', keywords: ['repair', 'maintenance', 'plumber', 'plumbing', 'hvac', 'landscap', 'lawn', 'pest control', 'handyman', 'cleaning', 'roofing', 'painting', 'contractor'] },
  { category: 'management_fee', keywords: ['management fee', 'property management', 'mgmt fee'] },
  { category: 'credit_card_payment', keywords: ['credit card', 'card payment', 'chase card', 'amex', 'american express', 'visa payment', 'mastercard', 'citi card', 'capital one', 'discover card', 'cc payment', 'payment to'] },
  { category: 'cash_withdrawal', keywords: ['atm', 'cash withdrawal', 'cash back', 'withdraw'] },
  { category: 'groceries', keywords: ['grocery', 'groceries', 'supermarket', 'walmart', 'costco', 'kroger', 'safeway', 'aldi', 'trader joe', 'whole foods', 'publix', 'heb', 'food lion'] },
  { category: 'legal', keywords: ['attorney', 'lawyer', 'legal fee', 'law firm', 'notary', 'court'] },
  { category: 'advertising', keywords: ['advertising', 'marketing', 'zillow', 'apartments.com', 'craigslist', 'listing fee'] },
  { category: 'supplies', keywords: ['supplies', 'hardware store', 'home depot', 'lowes', 'menards'] },
  { category: 'transfer', keywords: ['transfer', 'xfer', 'wire', 'zelle', 'venmo', 'paypal'] },
];

const INCOME_CATEGORIES = new Set(['rent_income', 'other_income']);
const CC_PAYMENT_KEYWORDS = ['payment', 'thank you', 'payment received', 'autopay', 'online payment', 'payment credit', 'pymt'];

function autoDetectCategory(description: string): string | null {
  const desc = description.toLowerCase();
  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    for (const kw of keywords) {
      if (desc.includes(kw)) return category;
    }
  }
  return null;
}

function getTypeForCategory(category: string, sourceType: string, amount: number): string {
  if (category === 'credit_card_payment') return 'cc_payment';
  if (category === 'transfer') return 'transfer';
  if (INCOME_CATEGORIES.has(category)) return 'income';
  // CC statement transactions are expenses (except payment credits handled separately)
  if (sourceType === 'credit_card') return 'expense';
  // Bank: positive uncategorized amounts might be income
  if (category === 'uncategorized' && amount > 0) return 'income';
  return 'expense';
}

function isCCPaymentCredit(description: string, amount: number, sourceType: string): boolean {
  if (sourceType !== 'credit_card') return false;
  // On CC statements, payment credits are positive amounts with payment-related descriptions
  if (amount <= 0) return false;
  const desc = description.toLowerCase();
  return CC_PAYMENT_KEYWORDS.some(kw => desc.includes(kw));
}

function generateHash(row: CSVRow): string {
  const str = `${row.date}|${row.description}|${row.amount.toFixed(2)}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// Try to find a matching bank "credit card payment" transaction for CC imports
async function findParentPayment(supabase: any, userId: string, ccRows: CSVRow[]): Promise<string | null> {
  if (ccRows.length === 0) return null;

  // Calculate the total of CC transactions (absolute sum of expenses)
  const totalAmount = ccRows.reduce((sum, r) => sum + Math.abs(r.amount), 0);
  
  // Find the date range of CC transactions
  const dates = ccRows.map(r => r.date).sort();
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];
  
  // Look for a bank transaction near the end of the billing period
  // that matches the total amount (within 5% tolerance)
  const searchStart = minDate;
  // Extend search 30 days past the last CC transaction
  const endDateObj = new Date(maxDate);
  endDateObj.setDate(endDateObj.getDate() + 30);
  const searchEnd = endDateObj.toISOString().split('T')[0];

  console.log(`Looking for parent payment: total=${totalAmount.toFixed(2)}, range=${searchStart} to ${searchEnd}`);

  const { data: candidates } = await supabase
    .from('transactions')
    .select('id, amount, description, date')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .gte('date', searchStart)
    .lte('date', searchEnd)
    .is('parent_transaction_id', null);

  if (!candidates || candidates.length === 0) return null;

  // Find the best match by amount (within 5% tolerance)
  const tolerance = totalAmount * 0.05;
  let bestMatch: any = null;
  let bestDiff = Infinity;

  for (const tx of candidates) {
    const txAmount = Math.abs(typeof tx.amount === 'string' ? parseFloat(tx.amount) : Number(tx.amount));
    const diff = Math.abs(txAmount - totalAmount);
    if (diff <= tolerance && diff < bestDiff) {
      // Also check if description looks like a credit card payment
      const desc = tx.description.toLowerCase();
      const isCCPayment = desc.includes('credit card') || desc.includes('card payment') ||
        desc.includes('chase') || desc.includes('amex') || desc.includes('visa') ||
        desc.includes('mastercard') || desc.includes('citi') || desc.includes('capital one') ||
        desc.includes('tarjeta') || desc.includes('tc ');
      
      if (isCCPayment || diff < tolerance * 0.5) {
        bestMatch = tx;
        bestDiff = diff;
      }
    }
  }

  if (bestMatch) {
    console.log(`Found parent payment: ${bestMatch.id} - ${bestMatch.description} ($${bestMatch.amount})`);
  }

  return bestMatch?.id || null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    const userId = authData.user.id;

    const body = await req.json();
    const mode = body.mode || 'direct';

    // ── PREVIEW MODE ──
    if (mode === 'preview') {
      const { csvContent, sourceType = 'bank' } = body;
      console.log(`Preview mode: parsing CSV (${sourceType})`);

      const rows = parseCSV(csvContent);

      // Get existing hashes for duplicate detection
      const { data: existingTx } = await supabase
        .from('transactions').select('hash').eq('user_id', userId);
      const existingHashes = new Set(existingTx?.map((t: any) => t.hash) || []);

      // Get user rules
      const { data: rules } = await supabase
        .from('rules').select('*').eq('user_id', userId).eq('is_active', true)
        .order('priority', { ascending: false });

      const previewRows = rows.map(row => {
        const hash = generateHash(row);
        const isDuplicate = existingHashes.has(hash);

        let category = 'uncategorized';
        let matchedByRule = false;

        // Priority 1: User rules
        for (const rule of rules || []) {
          let matches = false;
          if (rule.match_type === 'contains') {
            matches = row.description.toLowerCase().includes(rule.pattern.toLowerCase());
          } else if (rule.match_type === 'regex') {
            try { matches = new RegExp(rule.pattern, 'i').test(row.description); } catch {}
          }
          if (matches) {
            category = rule.category;
            matchedByRule = true;
            break;
          }
        }

        // Priority 2: Keyword detection
        if (!matchedByRule) {
          const detected = autoDetectCategory(row.description);
          if (detected) category = detected;
        }

        // Check if this is a CC payment credit (on CC statements)
        const ccPaymentCredit = isCCPaymentCredit(row.description, row.amount, sourceType);
        if (ccPaymentCredit) {
          category = 'credit_card_payment';
        }

        const type = ccPaymentCredit ? 'cc_payment' : getTypeForCategory(category, sourceType, row.amount);

        return {
          date: row.date,
          description: row.description,
          amount: row.amount,
          hash,
          isDuplicate,
          suggestedCategory: category,
          suggestedType: type,
          needsReview: category === 'uncategorized',
          isCCPayment: category === 'credit_card_payment' || ccPaymentCredit,
        };
      });

      return new Response(JSON.stringify({ rows: previewRows }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── COMMIT MODE ──
    if (mode === 'commit') {
      const { filename, sourceType = 'bank', accountId, rows: reviewedRows } = body;
      console.log(`Commit mode: ${reviewedRows.length} rows for ${filename} (${sourceType})`);

      // Create upload record
      const { data: upload, error: uploadError } = await supabase
        .from('statement_uploads')
        .insert({
          user_id: userId,
          filename,
          status: 'processing',
          source_type: sourceType,
          account_id: accountId || null,
        })
        .select().single();
      if (uploadError) throw uploadError;

      // Check for remaining duplicates (in case preview was stale)
      const { data: existingTx } = await supabase
        .from('transactions').select('hash').eq('user_id', userId);
      const existingHashes = new Set(existingTx?.map((t: any) => t.hash) || []);

      const toInsert = [];
      let duplicateCount = 0;

      for (const row of reviewedRows) {
        if (existingHashes.has(row.hash)) { duplicateCount++; continue; }
        existingHashes.add(row.hash);

        toInsert.push({
          user_id: userId,
          date: row.date,
          description: row.description,
          amount: row.amount,
          category: row.category,
          type: row.type,
          property_id: row.propertyId || null,
          unit_id: row.unitId || null,
          account_id: accountId || null,
          statement_upload_id: upload.id,
          needs_review: row.needsReview || row.category === 'uncategorized',
          hash: row.hash,
          raw_json: { date: row.date, description: row.description, amount: row.amount },
        });
      }

      if (toInsert.length > 0) {
        const { error: insertError } = await supabase.from('transactions').insert(toInsert);
        if (insertError) throw insertError;
      }

      // ── CC Payment Linking ──
      let linkedCount = 0;
      if (sourceType === 'credit_card') {
        // Find CC payment credit transactions we just inserted
        const { data: ccCredits } = await supabase
          .from('transactions')
          .select('id, amount, date')
          .eq('statement_upload_id', upload.id)
          .eq('type', 'cc_payment');

        for (const credit of ccCredits || []) {
          const creditAmount = Math.abs(typeof credit.amount === 'string' ? parseFloat(credit.amount) : Number(credit.amount));
          const creditDate = new Date(credit.date);

          // Find matching unlinked bank cc_payment
          const { data: bankPayments } = await supabase
            .from('transactions')
            .select('id, amount, date')
            .eq('user_id', userId)
            .eq('type', 'cc_payment')
            .is('linked_transaction_id', null)
            .neq('id', credit.id);

          for (const bankTx of bankPayments || []) {
            const bankAmount = Math.abs(typeof bankTx.amount === 'string' ? parseFloat(bankTx.amount) : Number(bankTx.amount));
            const bankDate = new Date(bankTx.date);
            const daysDiff = Math.abs((creditDate.getTime() - bankDate.getTime()) / 86400000);

            if (Math.abs(bankAmount - creditAmount) / creditAmount < 0.05 && daysDiff <= 3) {
              // Link both sides
              await supabase.from('transactions').update({ linked_transaction_id: bankTx.id }).eq('id', credit.id);
              await supabase.from('transactions').update({ linked_transaction_id: credit.id }).eq('id', bankTx.id);
              linkedCount++;
              break;
            }
          }
        }
      }

      // Update upload record
      await supabase
        .from('statement_uploads')
        .update({
          status: 'completed',
          row_count: reviewedRows.length,
          processed_count: toInsert.length,
          duplicate_count: duplicateCount,
          completed_at: new Date().toISOString(),
        })
        .eq('id', upload.id);

      console.log(`Committed: ${toInsert.length} inserted, ${duplicateCount} dupes, ${linkedCount} linked`);

      return new Response(JSON.stringify({
        success: true,
        processedCount: toInsert.length,
        duplicateCount,
        totalRows: reviewedRows.length,
        linkedCount,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── LEGACY DIRECT MODE (backward compat) ──
    const { filename, csvContent, sourceType = 'bank', accountId } = body;
    console.log(`Direct mode: ${filename} (${sourceType})`);

    const { data: upload, error: uploadError } = await supabase
      .from('statement_uploads')
      .insert({ user_id: userId, filename, status: 'processing', source_type: sourceType, account_id: accountId || null })
      .select().single();
    if (uploadError) throw uploadError;

    const rows = parseCSV(csvContent);
    const { data: existingTx } = await supabase.from('transactions').select('hash').eq('user_id', userId);
    const existingHashes = new Set(existingTx?.map((t: any) => t.hash) || []);
    const { data: rules } = await supabase.from('rules').select('*').eq('user_id', userId).eq('is_active', true).order('priority', { ascending: false });

    const toInsert = [];
    let duplicateCount = 0;

    for (const row of rows) {
      const hash = generateHash(row);
      if (existingHashes.has(hash)) { duplicateCount++; continue; }
      existingHashes.add(hash);

      let category = 'uncategorized';
      let propertyId = null;
      let unitId = null;
      let matchedByRule = false;

      for (const rule of rules || []) {
        let matches = false;
        if (rule.match_type === 'contains') matches = row.description.toLowerCase().includes(rule.pattern.toLowerCase());
        else if (rule.match_type === 'regex') { try { matches = new RegExp(rule.pattern, 'i').test(row.description); } catch {} }
        if (matches) { category = rule.category; propertyId = rule.property_id; unitId = rule.unit_id; matchedByRule = true; break; }
      }

      if (!matchedByRule) {
        const detected = autoDetectCategory(row.description);
        if (detected) category = detected;
      }

      const ccPaymentCredit = isCCPaymentCredit(row.description, row.amount, sourceType);
      if (ccPaymentCredit) category = 'credit_card_payment';
      const transactionType = ccPaymentCredit ? 'cc_payment' : getTypeForCategory(category, sourceType, row.amount);

      toInsert.push({
        user_id: userId, date: row.date, description: row.description, amount: row.amount,
        category, type: transactionType, property_id: propertyId, unit_id: unitId,
        account_id: accountId || null, statement_upload_id: upload.id,
        needs_review: category === 'uncategorized', hash, raw_json: row,
      });
    }

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase.from('transactions').insert(toInsert);
      if (insertError) throw insertError;
    }

    await supabase.from('statement_uploads').update({
      status: 'completed', row_count: rows.length, processed_count: toInsert.length,
      duplicate_count: duplicateCount, completed_at: new Date().toISOString(),
    }).eq('id', upload.id);

    return new Response(JSON.stringify({
      success: true, processedCount: toInsert.length, duplicateCount, totalRows: rows.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error processing CSV:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
