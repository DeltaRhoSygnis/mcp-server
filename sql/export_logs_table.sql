-- Export logs table for Google Drive integration
-- Tracks all database exports and their Google Drive upload status

CREATE TABLE IF NOT EXISTS export_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id TEXT NOT NULL, -- Google Drive file ID
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL, -- Google Drive web view link
    tables_exported TEXT[] NOT NULL, -- Array of table names exported
    export_config JSONB NOT NULL, -- Export configuration used
    file_size BIGINT DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'uploading', 'completed', 'failed')),
    error_message TEXT,
    branch_id UUID, -- Optional branch filter used
    date_range_start TIMESTAMPTZ,
    date_range_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_export_logs_status ON export_logs(status);
CREATE INDEX IF NOT EXISTS idx_export_logs_created_at ON export_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_logs_branch_id ON export_logs(branch_id);
CREATE INDEX IF NOT EXISTS idx_export_logs_tables ON export_logs USING GIN(tables_exported);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_export_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_export_logs_updated_at
    BEFORE UPDATE ON export_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_export_logs_updated_at();

-- Function to get export statistics
CREATE OR REPLACE FUNCTION get_export_stats(
    days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
    total_exports BIGINT,
    successful_exports BIGINT,
    failed_exports BIGINT,
    total_size_mb NUMERIC,
    most_exported_tables TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_exports,
        COUNT(*) FILTER (WHERE status = 'completed') as successful_exports,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_exports,
        ROUND((SUM(file_size) / 1024.0 / 1024.0)::NUMERIC, 2) as total_size_mb,
        (
            SELECT array_agg(DISTINCT unnest_table ORDER BY count DESC)
            FROM (
                SELECT unnest(tables_exported) as unnest_table, COUNT(*) as count
                FROM export_logs
                WHERE created_at >= NOW() - INTERVAL '1 day' * days_back
                GROUP BY unnest(tables_exported)
                ORDER BY count DESC
                LIMIT 5
            ) t
        ) as most_exported_tables
    FROM export_logs
    WHERE created_at >= NOW() - INTERVAL '1 day' * days_back;
END;
$$ LANGUAGE plpgsql;