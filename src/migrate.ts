import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const SCHEMA_PATH = path.join(process.cwd(), 'sql', 'enhanced-database-schema.sql');

// Log to ai_audit_logs
async function logMigration(event: string, success: boolean, details?: string) {
  await supabase.from('ai_audit_logs').insert({
    tool_name: 'database_migration',
    input: { event },
    output: success ? 'Success' : 'Failed',
    error: success ? null : details,
    timestamp: new Date().toISOString(),
  });
}

export async function migrate(): Promise<{ success: boolean; message: string }> {
  try {
    // Check if tables exist (e.g., notes)
    const { error: checkError } = await supabase.from('notes').select('id').limit(1).maybeSingle();
    if (!checkError) {
      await logMigration('tables_exist', true);
      return { success: true, message: 'Database already initialized' };
    }

    // Read schema
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');

    // Run schema (Supabase .sql for DDL)
    const { error: runError } = await supabase.rpc('execute_sql', { sql: schemaSql }); // Assume RPC or use admin API if needed; fallback .sql()
    if (runError) throw runError;

    // Verify (re-check notes)
    const { error: verifyError } = await supabase.from('notes').select('id').limit(1).maybeSingle();
    if (verifyError) throw verifyError;

    await logMigration('schema_applied', true);
    return { success: true, message: 'Database migrated successfully' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    await logMigration('migration_failed', false, msg);
    return { success: false, message: `Migration failed: ${msg}` };
  }
}

// Manual run: node dist/migrate.js
if (import.meta.url === `file://${process.argv[1]}`) {
  migrate().then(console.log).catch(console.error);
}