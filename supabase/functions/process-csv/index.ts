 import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
 import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/['"]/g, "");
}

// Parse a single CSV line handling quoted fields
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

// Column name patterns for different languages/banks
const DATE_PATTERNS = ['date', 'fecha', 'posted', 'transaction date', 'posting date', 'value date', 'fecha valor', 'fecha operacion'];
const DESC_PATTERNS = ['description', 'descripcion', 'memo', 'payee', 'details', 'detalle', 'concepto', 'narrative', 'reference', 'referencia'];
const AMOUNT_PATTERNS = ['amount', 'monto', 'importe', 'value', 'valor'];
const DEBIT_PATTERNS = ['debit', 'debito', 'withdrawal', 'retiro', 'cargo', 'debits'];
const CREDIT_PATTERNS = ['credit', 'credito', 'deposit', 'deposito', 'abono', 'credits'];

function findColumnIndex(headers: string[], patterns: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const normalized = normalizeHeader(headers[i]);
    for (const pattern of patterns) {
      if (normalized.includes(pattern) || normalized === pattern) {
        return i;
      }
    }
  }
  return -1;
}

function findHeaderRow(lines: string[]): { headerIndex: number; headers: string[] } {
  // Check first 30 lines for a valid header row (bank CSVs often have metadata rows)
  for (let i = 0; i < Math.min(30, lines.length); i++) {
    const cells = parseCSVLine(lines[i]);
    const dateIdx = findColumnIndex(cells, DATE_PATTERNS);
    const descIdx = findColumnIndex(cells, DESC_PATTERNS);
    
    console.log(`Row ${i}: ${cells.slice(0, 3).join(', ')} | Date: ${dateIdx}, Desc: ${descIdx}`);
    
    if (dateIdx !== -1 && descIdx !== -1) {
      return { headerIndex: i, headers: cells };
    }
  }
  return { headerIndex: -1, headers: [] };
}

function parseCSV(csvContent: string): CSVRow[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return [];

  // Find the header row dynamically
  const { headerIndex, headers } = findHeaderRow(lines);
  
  if (headerIndex === -1) {
    console.log('Available headers in first line:', lines[0]);
    throw new Error('CSV must have date and description columns. Supported formats: English (Date, Description, Amount) or Spanish (Fecha, Descripción, Monto)');
  }

  console.log(`Found headers at row ${headerIndex}:`, headers);

  // Find column indices using patterns
  const dateIdx = findColumnIndex(headers, DATE_PATTERNS);
  const descIdx = findColumnIndex(headers, DESC_PATTERNS);
  const amountIdx = findColumnIndex(headers, AMOUNT_PATTERNS);
  const debitIdx = findColumnIndex(headers, DEBIT_PATTERNS);
  const creditIdx = findColumnIndex(headers, CREDIT_PATTERNS);

  console.log(`Column mapping - Date: ${dateIdx}, Desc: ${descIdx}, Amount: ${amountIdx}, Debit: ${debitIdx}, Credit: ${creditIdx}`);

  const rows: CSVRow[] = [];

  // Start from the row after the header
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

    // Parse date (supports various formats)
    let date = '';
    try {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        date = parsed.toISOString().split('T')[0];
      }
    } catch {
      continue;
    }

    if (date && description) {
      rows.push({ date, description, amount });
    }
  }

  return rows;
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
 
 serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response('ok', { headers: corsHeaders });
   }
 
   try {
     const authHeader = req.headers.get('Authorization');
     if (!authHeader?.startsWith('Bearer ')) {
       return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
         status: 401, 
         headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
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
         status: 401, 
         headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
       });
     }
     const userId = authData.user.id;
 
     const { filename, csvContent } = await req.json();
     console.log(`Processing CSV: ${filename} for user: ${userId}`);
 
     // Create upload record
     const { data: upload, error: uploadError } = await supabase
       .from('statement_uploads')
       .insert({ user_id: userId, filename, status: 'processing' })
       .select()
       .single();
 
     if (uploadError) throw uploadError;
 
     // Parse CSV
     const rows = parseCSV(csvContent);
     console.log(`Parsed ${rows.length} rows`);
 
     // Get existing hashes for deduplication
     const { data: existingTx } = await supabase
       .from('transactions')
       .select('hash')
       .eq('user_id', userId);
     
     const existingHashes = new Set(existingTx?.map(t => t.hash) || []);
 
     // Get user's rules for categorization
     const { data: rules } = await supabase
       .from('rules')
       .select('*')
       .eq('user_id', userId)
       .eq('is_active', true)
       .order('priority', { ascending: false });
 
     // Process transactions
     const toInsert = [];
     let duplicateCount = 0;
 
     for (const row of rows) {
       const hash = generateHash(row);
       
       if (existingHashes.has(hash)) {
         duplicateCount++;
         continue;
       }
       existingHashes.add(hash);
 
       // Apply rules
       let category = 'uncategorized';
       let propertyId = null;
       let unitId = null;
       
       for (const rule of rules || []) {
         let matches = false;
         if (rule.match_type === 'contains') {
           matches = row.description.toLowerCase().includes(rule.pattern.toLowerCase());
         } else if (rule.match_type === 'regex') {
           try {
             matches = new RegExp(rule.pattern, 'i').test(row.description);
           } catch {}
         }
         if (matches) {
           category = rule.category;
           propertyId = rule.property_id;
           unitId = rule.unit_id;
           break;
         }
       }
 
       toInsert.push({
         user_id: userId,
         date: row.date,
         description: row.description,
         amount: row.amount,
         category,
         property_id: propertyId,
         unit_id: unitId,
         statement_upload_id: upload.id,
         needs_review: category === 'uncategorized',
         hash,
         raw_json: row,
       });
     }
 
     // Insert transactions
     if (toInsert.length > 0) {
       const { error: insertError } = await supabase.from('transactions').insert(toInsert);
       if (insertError) throw insertError;
     }
 
     // Update upload status
     await supabase
       .from('statement_uploads')
       .update({
         status: 'completed',
         row_count: rows.length,
         processed_count: toInsert.length,
         duplicate_count: duplicateCount,
         completed_at: new Date().toISOString(),
       })
       .eq('id', upload.id);
 
     console.log(`Completed: ${toInsert.length} inserted, ${duplicateCount} duplicates`);
 
     return new Response(JSON.stringify({ 
       success: true,
       processedCount: toInsert.length,
       duplicateCount,
       totalRows: rows.length,
     }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
 
   } catch (error) {
     console.error('Error processing CSV:', error);
     return new Response(JSON.stringify({ error: error.message }), { 
       status: 500, 
       headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
     });
   }
 });