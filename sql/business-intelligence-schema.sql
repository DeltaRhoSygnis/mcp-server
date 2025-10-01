-- Business Intelligence and Reports Tables
-- Comprehensive schema for business intelligence automation and reporting

-- Create business_reports table for storing generated reports
CREATE TABLE IF NOT EXISTS business_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'custom')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    report_data JSONB NOT NULL DEFAULT '{}', -- Contains sections, insights, recommendations, kpis, charts
    generated_by VARCHAR(20) DEFAULT 'ai' CHECK (generated_by IN ('ai', 'scheduled', 'manual')),
    status VARCHAR(20) DEFAULT 'generated' CHECK (status IN ('generating', 'generated', 'exported', 'failed')),
    template_id UUID,
    metadata JSONB DEFAULT '{}',
    file_path TEXT, -- Path to exported file if applicable
    google_drive_file_id VARCHAR(255),
    google_drive_link TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for business_reports table
CREATE INDEX IF NOT EXISTS idx_business_reports_branch_id ON business_reports(branch_id);
CREATE INDEX IF NOT EXISTS idx_business_reports_type_date ON business_reports(report_type, date_from DESC);
CREATE INDEX IF NOT EXISTS idx_business_reports_status ON business_reports(status);
CREATE INDEX IF NOT EXISTS idx_business_reports_created_at ON business_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_reports_generated_by ON business_reports(generated_by);

-- Create partial index for active reports
CREATE INDEX IF NOT EXISTS idx_business_reports_active ON business_reports(branch_id, report_type, date_from DESC) 
WHERE status IN ('generated', 'exported');

-- Create gin index for report_data JSONB queries
CREATE INDEX IF NOT EXISTS idx_business_reports_data_gin ON business_reports USING GIN(report_data);

-- Create report_templates table for reusable report configurations
CREATE TABLE IF NOT EXISTS report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'custom')),
    template_config JSONB NOT NULL DEFAULT '{}', -- Contains sections configuration, styling, etc.
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    created_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for report_templates table
CREATE INDEX IF NOT EXISTS idx_report_templates_type ON report_templates(report_type);
CREATE INDEX IF NOT EXISTS idx_report_templates_active ON report_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_report_templates_default ON report_templates(is_default, report_type);

-- Create report_subscriptions table for automated report delivery
CREATE TABLE IF NOT EXISTS report_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_name VARCHAR(100) NOT NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly', 'quarterly')),
    template_id UUID REFERENCES report_templates(id) ON DELETE SET NULL,
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
    schedule_time TIME NOT NULL,
    day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday
    day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 31),
    recipients JSONB NOT NULL DEFAULT '[]', -- Array of email addresses
    delivery_options JSONB DEFAULT '{}', -- Export format, Google Drive settings, etc.
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for report_subscriptions table
CREATE INDEX IF NOT EXISTS idx_report_subscriptions_active ON report_subscriptions(is_active, next_run_at);
CREATE INDEX IF NOT EXISTS idx_report_subscriptions_branch ON report_subscriptions(branch_id);
CREATE INDEX IF NOT EXISTS idx_report_subscriptions_type ON report_subscriptions(report_type);

-- Create kpi_benchmarks table for performance tracking
CREATE TABLE IF NOT EXISTS kpi_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    kpi_name VARCHAR(100) NOT NULL,
    kpi_category VARCHAR(50) NOT NULL, -- 'financial', 'operational', 'customer', etc.
    target_value DECIMAL(15,2),
    warning_threshold DECIMAL(15,2),
    critical_threshold DECIMAL(15,2),
    measurement_unit VARCHAR(20), -- 'PHP', 'percent', 'count', etc.
    calculation_method TEXT, -- Description of how the KPI is calculated
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for kpi_benchmarks table
CREATE INDEX IF NOT EXISTS idx_kpi_benchmarks_branch ON kpi_benchmarks(branch_id);
CREATE INDEX IF NOT EXISTS idx_kpi_benchmarks_category ON kpi_benchmarks(kpi_category);
CREATE INDEX IF NOT EXISTS idx_kpi_benchmarks_active ON kpi_benchmarks(is_active);

-- Create function to calculate business intelligence KPIs
CREATE OR REPLACE FUNCTION calculate_business_kpis(
    p_branch_id UUID DEFAULT NULL,
    p_date_from DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    p_date_to DATE DEFAULT CURRENT_DATE
)
RETURNS JSON AS $$
DECLARE
    result JSON;
    sales_data RECORD;
    expenses_data RECORD;
    operations_data RECORD;
BEGIN
    -- Get sales data
    SELECT 
        COALESCE(SUM((parsed->>'amount')::NUMERIC), 0) as total_revenue,
        COUNT(*) as total_transactions,
        COALESCE(AVG((parsed->>'amount')::NUMERIC), 0) as avg_transaction
    INTO sales_data
    FROM notes 
    WHERE 
        category = 'sale'
        AND parsed IS NOT NULL
        AND created_at::DATE BETWEEN p_date_from AND p_date_to
        AND (p_branch_id IS NULL OR branch_id = p_branch_id);

    -- Get expenses data
    SELECT 
        COALESCE(SUM(amount::NUMERIC), 0) as total_expenses,
        COUNT(*) as total_expense_items,
        COALESCE(AVG(amount::NUMERIC), 0) as avg_expense
    INTO expenses_data
    FROM expenses 
    WHERE 
        created_at::DATE BETWEEN p_date_from AND p_date_to
        AND (p_branch_id IS NULL OR branch_id = p_branch_id);

    -- Get operations data
    SELECT 
        COUNT(*) as total_operations
    INTO operations_data
    FROM operations 
    WHERE 
        created_at::DATE BETWEEN p_date_from AND p_date_to
        AND (p_branch_id IS NULL OR branch_id = p_branch_id);

    -- Build result JSON
    SELECT json_build_object(
        'revenue', sales_data.total_revenue,
        'expenses', expenses_data.total_expenses,
        'profit', sales_data.total_revenue - expenses_data.total_expenses,
        'profitMargin', CASE 
            WHEN sales_data.total_revenue > 0 THEN 
                ROUND(((sales_data.total_revenue - expenses_data.total_expenses) / sales_data.total_revenue) * 100, 2)
            ELSE 0 
        END,
        'averageTransactionValue', sales_data.avg_transaction,
        'expenseRatio', CASE 
            WHEN sales_data.total_revenue > 0 THEN 
                ROUND((expenses_data.total_expenses / sales_data.total_revenue) * 100, 2)
            ELSE 0 
        END,
        'totalTransactions', sales_data.total_transactions,
        'totalExpenseItems', expenses_data.total_expense_items,
        'totalOperations', operations_data.total_operations,
        'operationalEfficiency', CASE 
            WHEN operations_data.total_operations > 0 THEN 
                ROUND(sales_data.total_transactions::NUMERIC / operations_data.total_operations, 2)
            ELSE 0 
        END,
        'period', json_build_object(
            'from', p_date_from,
            'to', p_date_to,
            'days', p_date_to - p_date_from + 1
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create function to get report statistics
CREATE OR REPLACE FUNCTION get_report_statistics(
    p_branch_id UUID DEFAULT NULL,
    p_days INTEGER DEFAULT 90
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    WITH report_stats AS (
        SELECT 
            COUNT(*) as total_reports,
            COUNT(*) FILTER (WHERE report_type = 'daily') as daily_reports,
            COUNT(*) FILTER (WHERE report_type = 'weekly') as weekly_reports,
            COUNT(*) FILTER (WHERE report_type = 'monthly') as monthly_reports,
            COUNT(*) FILTER (WHERE status = 'generated') as successful_reports,
            COUNT(*) FILTER (WHERE status = 'failed') as failed_reports,
            COUNT(*) FILTER (WHERE google_drive_file_id IS NOT NULL) as reports_uploaded_to_drive,
            AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_generation_time_seconds
        FROM business_reports 
        WHERE 
            (p_branch_id IS NULL OR branch_id = p_branch_id)
            AND created_at >= CURRENT_DATE - INTERVAL '1 day' * p_days
    )
    SELECT json_build_object(
        'totalReports', total_reports,
        'reportsByType', json_build_object(
            'daily', daily_reports,
            'weekly', weekly_reports,
            'monthly', monthly_reports
        ),
        'successRate', CASE 
            WHEN total_reports > 0 THEN ROUND((successful_reports::NUMERIC / total_reports) * 100, 2)
            ELSE 0 
        END,
        'driveUploadRate', CASE 
            WHEN successful_reports > 0 THEN ROUND((reports_uploaded_to_drive::NUMERIC / successful_reports) * 100, 2)
            ELSE 0 
        END,
        'avgGenerationTime', COALESCE(avg_generation_time_seconds, 0),
        'period', json_build_object(
            'days', p_days
        )
    ) INTO result
    FROM report_stats;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create function to cleanup old reports (keep only latest N per type per branch)
CREATE OR REPLACE FUNCTION cleanup_old_reports(
    p_keep_count INTEGER DEFAULT 50,
    p_report_type VARCHAR(20) DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    WITH ranked_reports AS (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY COALESCE(branch_id::TEXT, 'null'), report_type 
                   ORDER BY date_from DESC, created_at DESC
               ) as rn
        FROM business_reports
        WHERE 
            status IN ('generated', 'exported')
            AND (p_report_type IS NULL OR report_type = p_report_type)
    ),
    to_delete AS (
        SELECT id FROM ranked_reports WHERE rn > p_keep_count
    )
    DELETE FROM business_reports 
    WHERE id IN (SELECT id FROM to_delete);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS update_business_reports_updated_at ON business_reports;
CREATE TRIGGER update_business_reports_updated_at
    BEFORE UPDATE ON business_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_report_templates_updated_at ON report_templates;
CREATE TRIGGER update_report_templates_updated_at
    BEFORE UPDATE ON report_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_report_subscriptions_updated_at ON report_subscriptions;
CREATE TRIGGER update_report_subscriptions_updated_at
    BEFORE UPDATE ON report_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_kpi_benchmarks_updated_at ON kpi_benchmarks;
CREATE TRIGGER update_kpi_benchmarks_updated_at
    BEFORE UPDATE ON kpi_benchmarks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create view for active report subscriptions with next run times
CREATE OR REPLACE VIEW active_report_subscriptions AS
SELECT 
    s.*,
    t.name as template_name,
    CASE 
        WHEN s.next_run_at IS NULL OR s.next_run_at <= NOW() THEN true
        ELSE false
    END as is_due
FROM report_subscriptions s
LEFT JOIN report_templates t ON s.template_id = t.id
WHERE s.is_active = true
ORDER BY s.next_run_at ASC NULLS FIRST;

-- Insert default report templates
INSERT INTO report_templates (name, description, report_type, template_config, is_default) VALUES 
    ('Standard Daily Report', 'Comprehensive daily business performance report', 'daily', 
     '{"sections": ["executive_summary", "sales_performance", "expense_analysis", "operational_metrics"], "charts": ["daily_sales", "top_products", "expense_categories"]}'::jsonb, true),
    ('Weekly Performance Report', 'Weekly business performance with trends', 'weekly', 
     '{"sections": ["executive_summary", "sales_performance", "expense_analysis", "operational_metrics", "trends_analysis"], "charts": ["weekly_sales", "top_products", "expense_trends"]}'::jsonb, true),
    ('Monthly Business Intelligence', 'Comprehensive monthly business analysis', 'monthly', 
     '{"sections": ["executive_summary", "sales_performance", "expense_analysis", "operational_metrics", "trends_analysis", "forecasting"], "charts": ["monthly_trends", "product_performance", "expense_breakdown", "profit_analysis"]}'::jsonb, true)
ON CONFLICT DO NOTHING;

-- Insert default KPI benchmarks
INSERT INTO kpi_benchmarks (kpi_name, kpi_category, target_value, warning_threshold, critical_threshold, measurement_unit, calculation_method) VALUES 
    ('Daily Revenue', 'financial', 5000.00, 3000.00, 2000.00, 'PHP', 'Sum of all sales transactions per day'),
    ('Profit Margin', 'financial', 30.00, 20.00, 10.00, 'percent', '(Revenue - Expenses) / Revenue * 100'),
    ('Average Transaction Value', 'financial', 200.00, 150.00, 100.00, 'PHP', 'Total Revenue / Number of Transactions'),
    ('Daily Operations', 'operational', 50.00, 30.00, 20.00, 'count', 'Number of operational activities per day'),
    ('Expense Ratio', 'financial', 70.00, 80.00, 90.00, 'percent', 'Total Expenses / Total Revenue * 100')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE business_reports IS 'Stores generated business intelligence reports with comprehensive data and insights';
COMMENT ON TABLE report_templates IS 'Reusable report templates with predefined sections and configurations';
COMMENT ON TABLE report_subscriptions IS 'Automated report generation and delivery subscriptions';
COMMENT ON TABLE kpi_benchmarks IS 'Key performance indicator benchmarks and thresholds for business monitoring';
COMMENT ON FUNCTION calculate_business_kpis IS 'Calculates comprehensive business KPIs for a given period and branch';
COMMENT ON FUNCTION get_report_statistics IS 'Returns statistics about report generation and success rates';
COMMENT ON FUNCTION cleanup_old_reports IS 'Removes old reports keeping only the latest N records per type per branch';