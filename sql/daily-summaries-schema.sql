-- Daily Summaries and Archive Tables
-- Comprehensive schema for automated daily summaries and archival system

-- Create summaries table for storing daily/weekly/monthly summaries
CREATE TABLE IF NOT EXISTS summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    summary_type VARCHAR(20) NOT NULL CHECK (summary_type IN ('daily', 'weekly', 'monthly', 'custom')),
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    summary_data JSONB NOT NULL DEFAULT '{}',
    ai_summary TEXT,
    status VARCHAR(20) DEFAULT 'generated' CHECK (status IN ('generating', 'generated', 'failed', 'archived')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for summaries table
CREATE INDEX IF NOT EXISTS idx_summaries_branch_id ON summaries(branch_id);
CREATE INDEX IF NOT EXISTS idx_summaries_type_date ON summaries(summary_type, date_from DESC);
CREATE INDEX IF NOT EXISTS idx_summaries_status ON summaries(status);
CREATE INDEX IF NOT EXISTS idx_summaries_created_at ON summaries(created_at DESC);

-- Create partial index for active summaries
CREATE INDEX IF NOT EXISTS idx_summaries_active ON summaries(branch_id, summary_type, date_from DESC) 
WHERE status IN ('generated', 'generating');

-- Create gin index for summary_data JSONB queries
CREATE INDEX IF NOT EXISTS idx_summaries_data_gin ON summaries USING GIN(summary_data);

-- Create archive_logs table for tracking archival operations
CREATE TABLE IF NOT EXISTS archive_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    archive_type VARCHAR(20) NOT NULL CHECK (archive_type IN ('manual', 'automated', 'scheduled')),
    tables_archived TEXT[] NOT NULL,
    records_count JSONB NOT NULL DEFAULT '{}', -- {"notes": 150, "operations": 45, "expenses": 30}
    cutoff_date DATE NOT NULL,
    retention_days INTEGER NOT NULL,
    google_drive_file_id VARCHAR(255),
    google_drive_link TEXT,
    status VARCHAR(20) DEFAULT 'started' CHECK (status IN ('started', 'exporting', 'exported', 'deleting', 'completed', 'failed')),
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for archive_logs table
CREATE INDEX IF NOT EXISTS idx_archive_logs_branch_id ON archive_logs(branch_id);
CREATE INDEX IF NOT EXISTS idx_archive_logs_type ON archive_logs(archive_type);
CREATE INDEX IF NOT EXISTS idx_archive_logs_status ON archive_logs(status);
CREATE INDEX IF NOT EXISTS idx_archive_logs_cutoff_date ON archive_logs(cutoff_date);
CREATE INDEX IF NOT EXISTS idx_archive_logs_created_at ON archive_logs(created_at DESC);

-- Create automation_schedules table for scheduled tasks
CREATE TABLE IF NOT EXISTS automation_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_name VARCHAR(100) NOT NULL,
    schedule_type VARCHAR(20) NOT NULL CHECK (schedule_type IN ('daily_summary', 'archival', 'backup', 'report')),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
    time_of_day TIME NOT NULL,
    day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday
    day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 31),
    config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for automation_schedules table
CREATE INDEX IF NOT EXISTS idx_automation_schedules_type ON automation_schedules(schedule_type);
CREATE INDEX IF NOT EXISTS idx_automation_schedules_active ON automation_schedules(is_active, next_run_at);
CREATE INDEX IF NOT EXISTS idx_automation_schedules_branch ON automation_schedules(branch_id);

-- Create summary statistics functions
CREATE OR REPLACE FUNCTION get_summary_statistics(
    p_branch_id UUID DEFAULT NULL,
    p_summary_type VARCHAR(20) DEFAULT 'daily',
    p_days INTEGER DEFAULT 30
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    WITH summary_stats AS (
        SELECT 
            COUNT(*) as total_summaries,
            AVG((summary_data->>'totalSales')::NUMERIC) as avg_sales,
            AVG((summary_data->>'totalExpenses')::NUMERIC) as avg_expenses,
            AVG((summary_data->>'netProfit')::NUMERIC) as avg_profit,
            MAX((summary_data->>'totalSales')::NUMERIC) as max_sales,
            MIN((summary_data->>'totalSales')::NUMERIC) as min_sales,
            SUM((summary_data->>'noteCount')::INTEGER) as total_notes,
            SUM((summary_data->>'operationCount')::INTEGER) as total_operations
        FROM summaries 
        WHERE 
            (p_branch_id IS NULL OR branch_id = p_branch_id)
            AND summary_type = p_summary_type
            AND date_from >= CURRENT_DATE - INTERVAL '1 day' * p_days
            AND status = 'generated'
    )
    SELECT json_build_object(
        'totalSummaries', total_summaries,
        'averages', json_build_object(
            'sales', COALESCE(avg_sales, 0),
            'expenses', COALESCE(avg_expenses, 0),
            'profit', COALESCE(avg_profit, 0)
        ),
        'peaks', json_build_object(
            'maxSales', COALESCE(max_sales, 0),
            'minSales', COALESCE(min_sales, 0)
        ),
        'activity', json_build_object(
            'totalNotes', COALESCE(total_notes, 0),
            'totalOperations', COALESCE(total_operations, 0)
        ),
        'period', json_build_object(
            'days', p_days,
            'type', p_summary_type
        )
    ) INTO result
    FROM summary_stats;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create function to get archival statistics
CREATE OR REPLACE FUNCTION get_archival_statistics(
    p_branch_id UUID DEFAULT NULL,
    p_days INTEGER DEFAULT 90
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    WITH archival_stats AS (
        SELECT 
            COUNT(*) as total_archives,
            COUNT(*) FILTER (WHERE status = 'completed') as successful_archives,
            COUNT(*) FILTER (WHERE status = 'failed') as failed_archives,
            SUM((records_count->>'notes')::INTEGER) as total_notes_archived,
            SUM((records_count->>'operations')::INTEGER) as total_operations_archived,
            SUM((records_count->>'expenses')::INTEGER) as total_expenses_archived,
            AVG(retention_days) as avg_retention_days,
            COUNT(*) FILTER (WHERE google_drive_file_id IS NOT NULL) as drive_uploads
        FROM archive_logs 
        WHERE 
            (p_branch_id IS NULL OR branch_id = p_branch_id)
            AND created_at >= CURRENT_DATE - INTERVAL '1 day' * p_days
    )
    SELECT json_build_object(
        'totalArchives', COALESCE(total_archives, 0),
        'successRate', CASE 
            WHEN total_archives > 0 THEN ROUND((successful_archives::NUMERIC / total_archives) * 100, 2)
            ELSE 0 
        END,
        'recordsArchived', json_build_object(
            'notes', COALESCE(total_notes_archived, 0),
            'operations', COALESCE(total_operations_archived, 0),
            'expenses', COALESCE(total_expenses_archived, 0),
            'total', COALESCE(total_notes_archived + total_operations_archived + total_expenses_archived, 0)
        ),
        'driveUploads', COALESCE(drive_uploads, 0),
        'avgRetentionDays', COALESCE(avg_retention_days, 0),
        'period', json_build_object(
            'days', p_days
        )
    ) INTO result
    FROM archival_stats;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update trigger to summaries table
DROP TRIGGER IF EXISTS update_summaries_updated_at ON summaries;
CREATE TRIGGER update_summaries_updated_at
    BEFORE UPDATE ON summaries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply update trigger to automation_schedules table
DROP TRIGGER IF EXISTS update_automation_schedules_updated_at ON automation_schedules;
CREATE TRIGGER update_automation_schedules_updated_at
    BEFORE UPDATE ON automation_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to cleanup old summaries (keep only latest N per type per branch)
CREATE OR REPLACE FUNCTION cleanup_old_summaries(
    p_keep_count INTEGER DEFAULT 100,
    p_summary_type VARCHAR(20) DEFAULT 'daily'
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    WITH ranked_summaries AS (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY COALESCE(branch_id::TEXT, 'null'), summary_type 
                   ORDER BY date_from DESC
               ) as rn
        FROM summaries
        WHERE summary_type = p_summary_type
          AND status = 'generated'
    ),
    to_delete AS (
        SELECT id FROM ranked_summaries WHERE rn > p_keep_count
    )
    DELETE FROM summaries 
    WHERE id IN (SELECT id FROM to_delete);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to auto-schedule next run for automation schedules
CREATE OR REPLACE FUNCTION calculate_next_run(
    p_frequency VARCHAR(20),
    p_time_of_day TIME,
    p_day_of_week INTEGER DEFAULT NULL,
    p_day_of_month INTEGER DEFAULT NULL,
    p_from_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
    next_run TIMESTAMP WITH TIME ZONE;
    base_date DATE;
BEGIN
    base_date := p_from_date::DATE;
    
    CASE p_frequency
        WHEN 'daily' THEN
            next_run := (base_date + INTERVAL '1 day')::DATE + p_time_of_day;
        WHEN 'weekly' THEN
            -- Find next occurrence of the specified day of week
            next_run := (base_date + INTERVAL '1 day' * 
                        ((p_day_of_week - EXTRACT(DOW FROM base_date) + 7) % 7 + 
                         CASE WHEN EXTRACT(DOW FROM base_date) = p_day_of_week 
                              AND p_from_date::TIME < p_time_of_day THEN 0 ELSE 7 END
                        ))::DATE + p_time_of_day;
        WHEN 'monthly' THEN
            -- Find next occurrence of the specified day of month
            IF EXTRACT(DAY FROM base_date) < p_day_of_month OR 
               (EXTRACT(DAY FROM base_date) = p_day_of_month AND p_from_date::TIME < p_time_of_day) THEN
                next_run := (DATE_TRUNC('month', base_date) + INTERVAL '1 month' * 0 + 
                           INTERVAL '1 day' * (p_day_of_month - 1))::DATE + p_time_of_day;
            ELSE
                next_run := (DATE_TRUNC('month', base_date) + INTERVAL '1 month' + 
                           INTERVAL '1 day' * (p_day_of_month - 1))::DATE + p_time_of_day;
            END IF;
        ELSE
            RAISE EXCEPTION 'Invalid frequency: %', p_frequency;
    END CASE;
    
    RETURN next_run;
END;
$$ LANGUAGE plpgsql;

-- Create view for active automation schedules with next run times
CREATE OR REPLACE VIEW active_automation_schedules AS
SELECT 
    id,
    schedule_name,
    schedule_type,
    branch_id,
    frequency,
    time_of_day,
    day_of_week,
    day_of_month,
    config,
    last_run_at,
    next_run_at,
    error_count,
    CASE 
        WHEN next_run_at IS NULL OR next_run_at <= NOW() THEN true
        ELSE false
    END as is_due,
    created_at,
    updated_at
FROM automation_schedules
WHERE is_active = true
ORDER BY next_run_at ASC NULLS FIRST;

-- Create indexes for the view
CREATE INDEX IF NOT EXISTS idx_automation_schedules_due 
ON automation_schedules(is_active, next_run_at) 
WHERE is_active = true AND (next_run_at IS NULL OR next_run_at <= NOW());

-- Insert sample automation schedules
INSERT INTO automation_schedules (
    schedule_name, 
    schedule_type, 
    frequency, 
    time_of_day, 
    config
) VALUES 
    ('Daily Business Summary', 'daily_summary', 'daily', '00:30:00', 
     '{"includeArchival": false, "retentionDays": 90}'::jsonb),
    ('Weekly Archive Cleanup', 'archival', 'weekly', '01:00:00', 
     '{"retentionDays": 90, "tables": ["notes", "operations", "expenses"]}'::jsonb),
    ('Monthly Performance Report', 'report', 'monthly', '02:00:00', 
     '{"reportType": "comprehensive", "includeTrends": true}'::jsonb)
ON CONFLICT DO NOTHING;

-- Update next_run_at for all schedules
UPDATE automation_schedules 
SET next_run_at = calculate_next_run(frequency, time_of_day, day_of_week, day_of_month)
WHERE next_run_at IS NULL;

COMMENT ON TABLE summaries IS 'Stores daily, weekly, and monthly business summaries with AI insights';
COMMENT ON TABLE archive_logs IS 'Tracks archival operations including Google Drive exports and database cleanup';
COMMENT ON TABLE automation_schedules IS 'Manages scheduled automation tasks for summaries, archival, and reporting';
COMMENT ON FUNCTION get_summary_statistics IS 'Returns comprehensive statistics for business summaries over a specified period';
COMMENT ON FUNCTION get_archival_statistics IS 'Returns statistics about archival operations and data retention';
COMMENT ON FUNCTION cleanup_old_summaries IS 'Removes old summaries keeping only the latest N records per type per branch';
COMMENT ON FUNCTION calculate_next_run IS 'Calculates the next scheduled run time for automation tasks';