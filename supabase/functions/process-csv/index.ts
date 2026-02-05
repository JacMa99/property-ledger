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
 
 function parseCSV(csvContent: string): CSVRow[] {
   const lines = csvContent.trim().split('\n');
   if (lines.length < 2) return [];
 
   const headerLine = lines[0].toLowerCase();
   const headers = headerLine.split(',').map(h => h.trim().replace(/"/g, ''));
 
   // Find column indices
   const dateIdx = headers.findIndex(h => h.includes('date') || h.includes('posted'));
   const descIdx = headers.findIndex(h => h.includes('description') || h.includes('memo') || h.includes('payee'));
   const amountIdx = headers.findIndex(h => h === 'amount' || h.includes('amount'));
   const debitIdx = headers.findIndex(h => h.includes('debit') || h.includes('withdrawal'));
   const creditIdx = headers.findIndex(h => h.includes('credit') || h.includes('deposit'));
 
   if (dateIdx === -1 || descIdx === -1) {
     throw new Error('CSV must have date and description columns');
   }
 
   const rows: CSVRow[] = [];
 
   for (let i = 1; i < lines.length; i++) {
     const line = lines[i].trim();
     if (!line) continue;
 
     // Simple CSV parsing (handles quoted fields)
     const values: string[] = [];
     let current = '';
     let inQuotes = false;
     for (const char of line) {
       if (char === '"') {
         inQuotes = !inQuotes;
       } else if (char === ',' && !inQuotes) {
         values.push(current.trim());
         current = '';
       } else {
         current += char;
       }
     }
     values.push(current.trim());
 
     const dateStr = values[dateIdx]?.replace(/"/g, '');
     const description = values[descIdx]?.replace(/"/g, '') || '';
 
     let amount = 0;
     if (amountIdx !== -1) {
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