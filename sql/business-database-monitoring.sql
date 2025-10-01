-- Business Database Monitoring and Overflow Management
-- SQL functions to support separated architecture with backup triggers

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create business database metrics monitoring table
CREATE TABLE IF NOT EXISTS business_db_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    row_count BIGINT NOT NULL,
    storage_mb DECIMAL(10,2) NOT NULL,
    storage_percent DECIMAL(5,2) NOT NULL,
    last_checked TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    overflow_threshold DECIMAL(3,2) DEFAULT 0.8, -- 80% threshold
    backup_triggered BOOLEAN DEFAULT FALSE,
    backup_last_run TIMESTAMP WITH TIME ZONE,
    UNIQUE(table_name)
);

-- Create backup logs table
CREATE TABLE IF NOT EXISTS backup_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    backup_type VARCHAR(50) NOT NULL, -- 'overflow', 'scheduled', 'manual'
    records_archived INTEGER NOT NULL DEFAULT 0,
    archive_size_mb DECIMAL(10,2),
    google_drive_file_id VARCHAR(255),
    google_drive_url TEXT,
    backup_db_table VARCHAR(100),
    status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'failed', 'partial')),
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(100) DEFAULT 'system'
);

-- Create indexes for backup logs
CREATE INDEX IF NOT EXISTS idx_backup_logs_table_name ON backup_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_backup_logs_started_at ON backup_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_logs_status ON backup_logs(status);

-- Function: Update table metrics
CREATE OR REPLACE FUNCTION update_table_metrics(
    p_table_name VARCHAR(100)
)
RETURNS VOID AS $$
DECLARE
    v_row_count BIGINT;
    v_storage_mb DECIMAL(10,2);
    v_storage_percent DECIMAL(5,2);
    v_max_storage_mb DECIMAL(10,2) := 500.0; -- Adjust based on your Supabase plan
BEGIN
    -- Get row count
    EXECUTE format('SELECT COUNT(*) FROM %I', p_table_name) INTO v_row_count;
    
    -- Estimate storage size (rough calculation)
    -- This is a simplified estimation - actual implementation would query pg_stat_user_tables
    v_storage_mb := (v_row_count * 1.0) / 1000; -- Rough estimate: 1KB per row average
    
    -- Calculate percentage of max storage
    v_storage_percent := (v_storage_mb / v_max_storage_mb) * 100;
    
    -- Upsert metrics
    INSERT INTO business_db_metrics (
        table_name, row_count, storage_mb, storage_percent, last_checked
    )
    VALUES (
        p_table_name, v_row_count, v_storage_mb, v_storage_percent, NOW()
    )
    ON CONFLICT (table_name) DO UPDATE SET
        row_count = EXCLUDED.row_count,
        storage_mb = EXCLUDED.storage_mb,
        storage_percent = EXCLUDED.storage_percent,
        last_checked = EXCLUDED.last_checked;
        
EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to update metrics for table %: %', p_table_name, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Function: Check storage limits across all monitored tables
CREATE OR REPLACE FUNCTION check_storage_limits()
RETURNS TABLE (
    table_name VARCHAR(100),
    row_count BIGINT,
    storage_mb DECIMAL(10,2),
    usage_percent DECIMAL(5,2),
    needs_backup BOOLEAN,
    last_backup TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    -- Update metrics for main business tables
    PERFORM update_table_metrics('sales');
    PERFORM update_table_metrics('expenses');
    PERFORM update_table_metrics('notes');
    PERFORM update_table_metrics('operations');
    
    -- Return current status
    RETURN QUERY
    SELECT 
        m.table_name,
        m.row_count,
        m.storage_mb,
        m.storage_percent as usage_percent,
        m.storage_percent > (m.overflow_threshold * 100) as needs_backup,
        b.backup_last_run as last_backup
    FROM business_db_metrics m
    LEFT JOIN (
        SELECT 
            table_name, 
            MAX(completed_at) as backup_last_run
        FROM backup_logs 
        WHERE status = 'success'
        GROUP BY table_name
    ) b ON b.table_name = m.table_name
    WHERE m.last_checked > NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Function: Get table metrics for specific table
CREATE OR REPLACE FUNCTION get_table_metrics(p_table_name VARCHAR(100))
RETURNS TABLE (
    row_count BIGINT,
    storage_mb DECIMAL(10,2),
    usage_percent DECIMAL(5,2),
    needs_backup BOOLEAN
) AS $$
BEGIN
    -- Update metrics first
    PERFORM update_table_metrics(p_table_name);
    
    -- Return metrics
    RETURN QUERY
    SELECT 
        m.row_count,
        m.storage_mb,
        m.storage_percent as usage_percent,
        m.storage_percent > (m.overflow_threshold * 100) as needs_backup
    FROM business_db_metrics m
    WHERE m.table_name = p_table_name;
END;
$$ LANGUAGE plpgsql;

-- Function: Log backup operation
CREATE OR REPLACE FUNCTION log_backup_operation(
    p_table_name VARCHAR(100),
    p_backup_type VARCHAR(50),
    p_records_archived INTEGER,
    p_archive_size_mb DECIMAL(10,2) DEFAULT NULL,
    p_google_drive_file_id VARCHAR(255) DEFAULT NULL,
    p_google_drive_url TEXT DEFAULT NULL,
    p_backup_db_table VARCHAR(100) DEFAULT NULL,
    p_status VARCHAR(20) DEFAULT 'success',
    p_error_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_backup_id UUID;
BEGIN
    INSERT INTO backup_logs (
        table_name, backup_type, records_archived, archive_size_mb,
        google_drive_file_id, google_drive_url, backup_db_table,
        status, error_message, completed_at
    )
    VALUES (
        p_table_name, p_backup_type, p_records_archived, p_archive_size_mb,
        p_google_drive_file_id, p_google_drive_url, p_backup_db_table,
        p_status, p_error_message, 
        CASE WHEN p_status = 'success' THEN NOW() ELSE NULL END
    )
    RETURNING id INTO v_backup_id;
    
    -- Update metrics table with backup timestamp
    UPDATE business_db_metrics 
    SET 
        backup_triggered = (p_status = 'success'),
        backup_last_run = CASE WHEN p_status = 'success' THEN NOW() ELSE backup_last_run END
    WHERE table_name = p_table_name;
    
    RETURN v_backup_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Get old records for archival (3+ months old)
CREATE OR REPLACE FUNCTION get_archivable_records(
    p_table_name VARCHAR(100),
    p_months_old INTEGER DEFAULT 3,
    p_limit INTEGER DEFAULT 1000
)
RETURNS TABLE (
    record_data JSONB,
    record_count INTEGER
) AS $$
DECLARE
    v_cutoff_date TIMESTAMP WITH TIME ZONE;
    v_query TEXT;
    v_count INTEGER;
BEGIN
    v_cutoff_date := NOW() - (p_months_old || ' months')::INTERVAL;
    
    -- Build dynamic query
    v_query := format(
        'SELECT to_jsonb(t.*) FROM %I t WHERE t.created_at < %L ORDER BY t.created_at LIMIT %s',
        p_table_name, v_cutoff_date, p_limit
    );
    
    -- Get count first
    EXECUTE format(
        'SELECT COUNT(*) FROM %I WHERE created_at < %L',
        p_table_name, v_cutoff_date
    ) INTO v_count;
    
    -- Return records and count
    RETURN QUERY EXECUTE format(
        'SELECT to_jsonb(t.*), %s FROM %I t WHERE t.created_at < %L ORDER BY t.created_at LIMIT %s',
        v_count, p_table_name, v_cutoff_date, p_limit
    );
END;
$$ LANGUAGE plpgsql;

-- Function: Clean archived records from primary table
CREATE OR REPLACE FUNCTION clean_archived_records(
    p_table_name VARCHAR(100),
    p_months_old INTEGER DEFAULT 3,
    p_batch_size INTEGER DEFAULT 1000
)
RETURNS INTEGER AS $$
DECLARE
    v_cutoff_date TIMESTAMP WITH TIME ZONE;
    v_deleted_count INTEGER := 0;
    v_batch_count INTEGER;
BEGIN
    v_cutoff_date := NOW() - (p_months_old || ' months')::INTERVAL;
    
    -- Delete in batches to avoid long-running transactions
    LOOP
        EXECUTE format(
            'WITH deleted AS (
                DELETE FROM %I 
                WHERE created_at < %L 
                AND ctid IN (
                    SELECT ctid FROM %I 
                    WHERE created_at < %L 
                    LIMIT %s
                )
                RETURNING 1
            ) SELECT COUNT(*) FROM deleted',
            p_table_name, v_cutoff_date, p_table_name, v_cutoff_date, p_batch_size
        ) INTO v_batch_count;
        
        v_deleted_count := v_deleted_count + v_batch_count;
        
        -- Exit loop if no more records to delete
        EXIT WHEN v_batch_count = 0;
        
        -- Brief pause between batches
        PERFORM pg_sleep(0.1);
    END LOOP;
    
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function: Create monitoring tables if they don't exist
CREATE OR REPLACE FUNCTION create_monitoring_tables()
RETURNS VOID AS $$
BEGIN
    -- This function is called during initialization
    -- Tables are already created above, this is just for compatibility
    -- with the integrated memory system
    NULL;
END;
$$ LANGUAGE plpgsql;

-- Function: Get comprehensive backup status
CREATE OR REPLACE FUNCTION get_backup_status()
RETURNS TABLE (
    table_name VARCHAR(100),
    current_rows BIGINT,
    storage_mb DECIMAL(10,2),
    usage_percent DECIMAL(5,2),
    needs_backup BOOLEAN,
    last_backup TIMESTAMP WITH TIME ZONE,
    backup_count INTEGER,
    total_archived INTEGER,
    next_recommended_backup TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.table_name,
        m.row_count as current_rows,
        m.storage_mb,
        m.storage_percent as usage_percent,
        m.storage_percent > (m.overflow_threshold * 100) as needs_backup,
        b.last_backup,
        COALESCE(b.backup_count, 0) as backup_count,
        COALESCE(b.total_archived, 0) as total_archived,
        CASE 
            WHEN m.storage_percent > (m.overflow_threshold * 100) THEN NOW()
            WHEN b.last_backup IS NULL THEN NOW() + INTERVAL '7 days'
            ELSE b.last_backup + INTERVAL '30 days'
        END as next_recommended_backup
    FROM business_db_metrics m
    LEFT JOIN (
        SELECT 
            table_name,
            MAX(completed_at) as last_backup,
            COUNT(*) as backup_count,
            SUM(records_archived) as total_archived
        FROM backup_logs 
        WHERE status = 'success'
        GROUP BY table_name
    ) b ON b.table_name = m.table_name
    ORDER BY m.storage_percent DESC;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update metrics on INSERT/UPDATE/DELETE
CREATE OR REPLACE FUNCTION trigger_update_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update metrics for the affected table
    PERFORM update_table_metrics(TG_TABLE_NAME);
    
    -- Return appropriate record based on operation
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to main business tables
DROP TRIGGER IF EXISTS sales_metrics_trigger ON sales;
CREATE TRIGGER sales_metrics_trigger
    AFTER INSERT OR UPDATE OR DELETE ON sales
    FOR EACH STATEMENT EXECUTE FUNCTION trigger_update_metrics();

DROP TRIGGER IF EXISTS expenses_metrics_trigger ON expenses;
CREATE TRIGGER expenses_metrics_trigger
    AFTER INSERT OR UPDATE OR DELETE ON expenses
    FOR EACH STATEMENT EXECUTE FUNCTION trigger_update_metrics();

DROP TRIGGER IF EXISTS notes_metrics_trigger ON notes;
CREATE TRIGGER notes_metrics_trigger
    AFTER INSERT OR UPDATE OR DELETE ON notes
    FOR EACH STATEMENT EXECUTE FUNCTION trigger_update_metrics();

-- Initialize metrics for existing tables
DO $$
BEGIN
    -- Only run if tables exist
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sales') THEN
        PERFORM update_table_metrics('sales');
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'expenses') THEN
        PERFORM update_table_metrics('expenses');
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notes') THEN
        PERFORM update_table_metrics('notes');
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'operations') THEN
        PERFORM update_table_metrics('operations');
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore errors during initialization
    RAISE NOTICE 'Metrics initialization completed with warnings: %', SQLERRM;
END $$;

-- Grant permissions (adjust based on your security requirements)
-- GRANT EXECUTE ON FUNCTION check_storage_limits() TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_table_metrics(VARCHAR) TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_backup_status() TO authenticated;

COMMENT ON TABLE business_db_metrics IS 'Monitors storage usage and overflow thresholds for business tables';
COMMENT ON TABLE backup_logs IS 'Logs all backup operations with Google Drive and backup database details';
COMMENT ON FUNCTION check_storage_limits() IS 'Checks current storage usage across all monitored tables';
COMMENT ON FUNCTION get_table_metrics(VARCHAR) IS 'Gets detailed metrics for a specific table';
COMMENT ON FUNCTION log_backup_operation IS 'Logs backup operations with Google Drive and backup DB details';
COMMENT ON FUNCTION clean_archived_records IS 'Safely removes archived records from primary tables in batches';