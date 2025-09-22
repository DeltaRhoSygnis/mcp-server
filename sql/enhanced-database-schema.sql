-- Enhanced Supabase Functions for MCP Server Integration
-- Production-ready SQL functions for chicken business intelligence

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Create enhanced AI audit logs table with better indexing
CREATE TABLE IF NOT EXISTS ai_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    operation_type VARCHAR(50) NOT NULL,
    input_data JSONB,
    output_data JSONB,
    model_used VARCHAR(100),
    tokens_used INTEGER DEFAULT 0,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    processing_time_ms INTEGER,
    user_id UUID REFERENCES auth.users(id),
    request_id VARCHAR(100),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_created_at ON ai_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_operation_type ON ai_audit_logs(operation_type);
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_success ON ai_audit_logs(success);
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_user_id ON ai_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_request_id ON ai_audit_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_model_used ON ai_audit_logs(model_used);

-- Enhanced notes table with better structure
CREATE TABLE IF NOT EXISTS notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    local_uuid VARCHAR(100) UNIQUE,
    branch_id UUID NOT NULL,
    author_id UUID REFERENCES auth.users(id),
    content TEXT NOT NULL,
    parsed JSONB,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'parsed', 'confirmed', 'synced')),
    category VARCHAR(50), -- 'daily_report', 'expense', 'sale', 'purchase', 'inventory', 'health'
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    tags TEXT[], -- Array of tags for better categorization
    confidence_score FLOAT, -- AI parsing confidence (0-1)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    synced_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for notes
CREATE INDEX IF NOT EXISTS idx_notes_branch_id ON notes(branch_id);
CREATE INDEX IF NOT EXISTS idx_notes_author_id ON notes(author_id);
CREATE INDEX IF NOT EXISTS idx_notes_status ON notes(status);
CREATE INDEX IF NOT EXISTS idx_notes_category ON notes(category);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_local_uuid ON notes(local_uuid);
CREATE INDEX IF NOT EXISTS idx_notes_tags ON notes USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_notes_content_fts ON notes USING GIN(to_tsvector('english', content));

-- Enhanced note embeddings table
CREATE TABLE IF NOT EXISTS note_embeddings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
    embedding vector(768), -- Gemini embedding dimension
    model_used VARCHAR(100) DEFAULT 'text-embedding-004',
    chunk_index INTEGER DEFAULT 0, -- For large notes split into chunks
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create vector similarity index
CREATE INDEX IF NOT EXISTS idx_note_embeddings_vector ON note_embeddings 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_note_embeddings_note_id ON note_embeddings(note_id);

-- Enhanced operations table
CREATE TABLE IF NOT EXISTS operations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    local_uuid VARCHAR(100) UNIQUE,
    operation_type VARCHAR(50) NOT NULL, -- 'purchase', 'sale', 'inventory_change', 'expense'
    operation_details JSONB NOT NULL,
    branch_id UUID NOT NULL,
    author_id UUID REFERENCES auth.users(id),
    related_note_id UUID REFERENCES notes(id),
    amount DECIMAL(12,2), -- Extracted financial amount
    quantity INTEGER, -- Extracted quantity
    unit_price DECIMAL(10,2), -- Extracted unit price
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    synced_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for operations
CREATE INDEX IF NOT EXISTS idx_operations_branch_id ON operations(branch_id);
CREATE INDEX IF NOT EXISTS idx_operations_author_id ON operations(author_id);
CREATE INDEX IF NOT EXISTS idx_operations_type ON operations(operation_type);
CREATE INDEX IF NOT EXISTS idx_operations_created_at ON operations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operations_local_uuid ON operations(local_uuid);
CREATE INDEX IF NOT EXISTS idx_operations_related_note ON operations(related_note_id);

-- Enhanced summaries table
CREATE TABLE IF NOT EXISTS summaries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id UUID NOT NULL,
    summary_type VARCHAR(50) NOT NULL, -- 'daily', 'weekly', 'monthly', 'custom'
    date_from TIMESTAMP WITH TIME ZONE NOT NULL,
    date_to TIMESTAMP WITH TIME ZONE NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    generated_by VARCHAR(50) DEFAULT 'ai_assistant',
    model_used VARCHAR(100),
    confidence_score FLOAT,
    status VARCHAR(20) DEFAULT 'generated' CHECK (status IN ('generated', 'reviewed', 'approved')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for summaries
CREATE INDEX IF NOT EXISTS idx_summaries_branch_id ON summaries(branch_id);
CREATE INDEX IF NOT EXISTS idx_summaries_type ON summaries(summary_type);
CREATE INDEX IF NOT EXISTS idx_summaries_date_range ON summaries(date_from, date_to);
CREATE INDEX IF NOT EXISTS idx_summaries_created_at ON summaries(created_at DESC);

-- Function: Search notes by content with similarity scoring
CREATE OR REPLACE FUNCTION search_notes_by_content(
    search_query TEXT,
    branch_filter UUID DEFAULT NULL,
    result_limit INTEGER DEFAULT 5,
    similarity_threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    parsed JSONB,
    similarity FLOAT,
    created_at TIMESTAMP WITH TIME ZONE,
    category VARCHAR(50),
    tags TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.id,
        n.content,
        n.parsed,
        similarity(n.content, search_query) as similarity,
        n.created_at,
        n.category,
        n.tags
    FROM notes n
    WHERE 
        (branch_filter IS NULL OR n.branch_id = branch_filter)
        AND n.status = 'parsed'
        AND similarity(n.content, search_query) > similarity_threshold
    ORDER BY similarity DESC
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Function: Vector similarity search for notes
CREATE OR REPLACE FUNCTION search_notes_by_embedding(
    query_embedding vector(768),
    branch_filter UUID DEFAULT NULL,
    result_limit INTEGER DEFAULT 5,
    similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    note_id UUID,
    content TEXT,
    parsed JSONB,
    similarity FLOAT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.id as note_id,
        n.content,
        n.parsed,
        1 - (ne.embedding <=> query_embedding) as similarity,
        n.created_at
    FROM note_embeddings ne
    JOIN notes n ON ne.note_id = n.id
    WHERE 
        (branch_filter IS NULL OR n.branch_id = branch_filter)
        AND n.status = 'parsed'
        AND (1 - (ne.embedding <=> query_embedding)) > similarity_threshold
    ORDER BY ne.embedding <=> query_embedding
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Function: Upsert operation with conflict resolution
CREATE OR REPLACE FUNCTION upsert_operation(
    p_local_uuid VARCHAR(100),
    p_operation_type VARCHAR(50),
    p_operation_details JSONB,
    p_branch_id UUID,
    p_author_id UUID,
    p_related_note_id UUID DEFAULT NULL
)
RETURNS TABLE (
    operation_id UUID,
    status TEXT,
    message TEXT
) AS $$
DECLARE
    v_operation_id UUID;
    v_amount DECIMAL(12,2);
    v_quantity INTEGER;
    v_unit_price DECIMAL(10,2);
BEGIN
    -- Extract financial data from operation details
    v_amount := COALESCE((p_operation_details->>'amount')::DECIMAL(12,2), 0);
    v_quantity := COALESCE((p_operation_details->>'quantity')::INTEGER, 0);
    v_unit_price := COALESCE((p_operation_details->>'unit_price')::DECIMAL(10,2), 0);

    -- Upsert operation
    INSERT INTO operations (
        local_uuid, operation_type, operation_details, branch_id, author_id, 
        related_note_id, amount, quantity, unit_price, synced_at
    )
    VALUES (
        p_local_uuid, p_operation_type, p_operation_details, p_branch_id, p_author_id,
        p_related_note_id, v_amount, v_quantity, v_unit_price, NOW()
    )
    ON CONFLICT (local_uuid) DO UPDATE SET
        operation_details = EXCLUDED.operation_details,
        amount = EXCLUDED.amount,
        quantity = EXCLUDED.quantity,
        unit_price = EXCLUDED.unit_price,
        updated_at = NOW(),
        synced_at = NOW()
    RETURNING id INTO v_operation_id;

    RETURN QUERY SELECT v_operation_id, 'success'::TEXT, 'Operation upserted successfully'::TEXT;

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT NULL::UUID, 'error'::TEXT, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Function: Get business analytics summary
CREATE OR REPLACE FUNCTION get_business_analytics(
    p_branch_id UUID,
    p_date_from TIMESTAMP WITH TIME ZONE,
    p_date_to TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
    total_sales DECIMAL(12,2),
    total_purchases DECIMAL(12,2),
    total_expenses DECIMAL(12,2),
    net_profit DECIMAL(12,2),
    transaction_count INTEGER,
    notes_count INTEGER,
    avg_transaction_value DECIMAL(12,2),
    top_categories JSONB,
    daily_breakdown JSONB
) AS $$
DECLARE
    v_sales DECIMAL(12,2);
    v_purchases DECIMAL(12,2);
    v_expenses DECIMAL(12,2);
    v_transaction_count INTEGER;
    v_notes_count INTEGER;
    v_top_categories JSONB;
    v_daily_breakdown JSONB;
BEGIN
    -- Calculate totals
    SELECT 
        COALESCE(SUM(CASE WHEN operation_type = 'sale' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN operation_type = 'purchase' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN operation_type = 'expense' THEN amount ELSE 0 END), 0),
        COUNT(*)
    INTO v_sales, v_purchases, v_expenses, v_transaction_count
    FROM operations
    WHERE branch_id = p_branch_id
        AND created_at BETWEEN p_date_from AND p_date_to
        AND status = 'active';

    -- Count notes
    SELECT COUNT(*)
    INTO v_notes_count
    FROM notes
    WHERE branch_id = p_branch_id
        AND created_at BETWEEN p_date_from AND p_date_to;

    -- Get top categories
    SELECT json_agg(category_data)
    INTO v_top_categories
    FROM (
        SELECT 
            operation_type as category,
            COUNT(*) as count,
            SUM(amount) as total_amount
        FROM operations
        WHERE branch_id = p_branch_id
            AND created_at BETWEEN p_date_from AND p_date_to
            AND status = 'active'
        GROUP BY operation_type
        ORDER BY SUM(amount) DESC
        LIMIT 5
    ) category_data;

    -- Get daily breakdown
    SELECT json_agg(daily_data)
    INTO v_daily_breakdown
    FROM (
        SELECT 
            DATE(created_at) as date,
            SUM(CASE WHEN operation_type = 'sale' THEN amount ELSE 0 END) as sales,
            SUM(CASE WHEN operation_type = 'purchase' THEN amount ELSE 0 END) as purchases,
            SUM(CASE WHEN operation_type = 'expense' THEN amount ELSE 0 END) as expenses,
            COUNT(*) as transactions
        FROM operations
        WHERE branch_id = p_branch_id
            AND created_at BETWEEN p_date_from AND p_date_to
            AND status = 'active'
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
    ) daily_data;

    RETURN QUERY SELECT 
        v_sales,
        v_purchases,
        v_expenses,
        v_sales - v_purchases - v_expenses as net_profit,
        v_transaction_count,
        v_notes_count,
        CASE WHEN v_transaction_count > 0 THEN (v_sales + v_purchases + v_expenses) / v_transaction_count ELSE 0 END,
        COALESCE(v_top_categories, '[]'::jsonb),
        COALESCE(v_daily_breakdown, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Function: Batch insert notes with embedding placeholders
CREATE OR REPLACE FUNCTION batch_insert_notes(
    notes_data JSONB
)
RETURNS TABLE (
    note_id UUID,
    local_uuid VARCHAR(100),
    status TEXT,
    message TEXT
) AS $$
DECLARE
    note_item JSONB;
    v_note_id UUID;
BEGIN
    FOR note_item IN SELECT jsonb_array_elements(notes_data)
    LOOP
        BEGIN
            INSERT INTO notes (
                local_uuid, branch_id, author_id, content, category, priority, tags
            )
            VALUES (
                (note_item->>'local_uuid')::VARCHAR(100),
                (note_item->>'branch_id')::UUID,
                (note_item->>'author_id')::UUID,
                note_item->>'content',
                note_item->>'category',
                COALESCE(note_item->>'priority', 'medium'),
                CASE 
                    WHEN note_item->'tags' IS NOT NULL 
                    THEN ARRAY(SELECT jsonb_array_elements_text(note_item->'tags'))
                    ELSE ARRAY[]::TEXT[]
                END
            )
            RETURNING id INTO v_note_id;

            RETURN QUERY SELECT 
                v_note_id,
                (note_item->>'local_uuid')::VARCHAR(100),
                'success'::TEXT,
                'Note inserted successfully'::TEXT;

        EXCEPTION WHEN OTHERS THEN
            RETURN QUERY SELECT 
                NULL::UUID,
                (note_item->>'local_uuid')::VARCHAR(100),
                'error'::TEXT,
                SQLERRM::TEXT;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function: Update note status and confidence
CREATE OR REPLACE FUNCTION update_note_analysis(
    p_note_id UUID,
    p_parsed JSONB,
    p_confidence_score FLOAT DEFAULT NULL,
    p_category VARCHAR(50) DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE notes 
    SET 
        parsed = p_parsed,
        confidence_score = COALESCE(p_confidence_score, confidence_score),
        category = COALESCE(p_category, category),
        status = 'parsed',
        updated_at = NOW()
    WHERE id = p_note_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS) Policies
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_embeddings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own data or data from their branches
CREATE POLICY "notes_access_policy" ON notes
    FOR ALL USING (
        auth.uid() = author_id 
        OR auth.uid() IN (
            SELECT user_id FROM user_branches WHERE branch_id = notes.branch_id
        )
    );

CREATE POLICY "operations_access_policy" ON operations
    FOR ALL USING (
        auth.uid() = author_id 
        OR auth.uid() IN (
            SELECT user_id FROM user_branches WHERE branch_id = operations.branch_id
        )
    );

-- Create function to clean old audit logs
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(
    retention_days INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM ai_audit_logs 
    WHERE created_at < NOW() - INTERVAL '1 day' * retention_days;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_operations_branch_date 
    ON operations(branch_id, created_at DESC) 
    WHERE status = 'active';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notes_branch_status_date 
    ON notes(branch_id, status, created_at DESC);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Create trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notes_updated_at 
    BEFORE UPDATE ON notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_operations_updated_at 
    BEFORE UPDATE ON operations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();