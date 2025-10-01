-- Memory System Tables for MCP Server
-- Creates the missing entities, relations, and observations tables that your memory tools require

-- Enable required extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create entities table for business knowledge graph
CREATE TABLE IF NOT EXISTS entities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL, -- Business entity name (Magnolia_Supplier, etc.)
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('supplier', 'customer', 'worker', 'branch', 'product', 'business_period', 'general')),
    metadata JSONB DEFAULT '{}'::jsonb, -- Flexible attributes storage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE, -- TTL support
    author VARCHAR(100), -- Who created this entity
    source VARCHAR(50) DEFAULT 'mcp_memory', -- Source system
    tags TEXT[] DEFAULT '{}', -- Filterable tags
    access_controls JSONB DEFAULT '{"roles": ["general"], "user_ids": []}'::jsonb, -- Access control
    human_review BOOLEAN DEFAULT false, -- Requires human approval
    confidence FLOAT DEFAULT 0.9 CHECK (confidence >= 0 AND confidence <= 1) -- Trust score
);

-- Create indexes for entities
CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
CREATE INDEX IF NOT EXISTS idx_entities_entity_type ON entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_entities_created_at ON entities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entities_expires_at ON entities(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entities_tags ON entities USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_entities_metadata ON entities USING GIN(metadata);

-- Create relations table for entity relationships
CREATE TABLE IF NOT EXISTS relations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    from_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    to_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    relation_type VARCHAR(100) NOT NULL, -- 'supplies', 'purchases', 'works_at', etc.
    metadata JSONB DEFAULT '{}'::jsonb, -- Additional relation data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE, -- TTL support
    author VARCHAR(100), -- Who created this relation
    source VARCHAR(50) DEFAULT 'mcp_memory', -- Source system
    tags TEXT[] DEFAULT '{}', -- Filterable tags
    access_controls JSONB DEFAULT '{"roles": ["general"], "user_ids": []}'::jsonb,
    human_review BOOLEAN DEFAULT false,
    confidence FLOAT DEFAULT 0.9 CHECK (confidence >= 0 AND confidence <= 1),
    UNIQUE(from_id, to_id, relation_type) -- Prevent duplicate relations
);

-- Create indexes for relations
CREATE INDEX IF NOT EXISTS idx_relations_from_id ON relations(from_id);
CREATE INDEX IF NOT EXISTS idx_relations_to_id ON relations(to_id);
CREATE INDEX IF NOT EXISTS idx_relations_relation_type ON relations(relation_type);
CREATE INDEX IF NOT EXISTS idx_relations_created_at ON relations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_relations_expires_at ON relations(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_relations_tags ON relations USING GIN(tags);

-- Create observations table for entity facts and notes (with vector embeddings)
CREATE TABLE IF NOT EXISTS observations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_name VARCHAR(255) NOT NULL, -- References entities.name (flexible reference)
    contents TEXT[] NOT NULL, -- Array of observation texts
    embedding vector(768), -- Gemini text-embedding-004 dimensions
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE, -- TTL support
    author VARCHAR(100), -- Who made this observation
    source VARCHAR(50) DEFAULT 'mcp_memory', -- Source system
    confidence FLOAT DEFAULT 0.9 CHECK (confidence >= 0 AND confidence <= 1),
    tags TEXT[] DEFAULT '{}', -- Filterable tags
    provenance JSONB DEFAULT '{}'::jsonb, -- Origin information
    access_controls JSONB DEFAULT '{"roles": ["general"], "user_ids": []}'::jsonb,
    human_review BOOLEAN DEFAULT false,
    model_used VARCHAR(100) DEFAULT 'text-embedding-004' -- Embedding model used
);

-- Create indexes for observations
CREATE INDEX IF NOT EXISTS idx_observations_entity_name ON observations(entity_name);
CREATE INDEX IF NOT EXISTS idx_observations_timestamp ON observations(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_observations_created_at ON observations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_observations_expires_at ON observations(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_observations_tags ON observations USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_observations_contents ON observations USING GIN(contents);

-- Create vector similarity index for semantic search
CREATE INDEX IF NOT EXISTS idx_observations_embedding ON observations 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Foreign key constraint to link observations to entities (soft reference)
-- Note: We use entity_name instead of entity_id for flexibility
-- but we can add a check constraint if needed

-- Create daily_summaries table for archival system
CREATE TABLE IF NOT EXISTS daily_summaries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id UUID, -- References your existing branch system
    summary_date DATE NOT NULL,
    content TEXT NOT NULL, -- AI-generated summary
    summary_type VARCHAR(50) DEFAULT 'daily' CHECK (summary_type IN ('daily', 'weekly', 'monthly', 'archive')),
    metadata JSONB DEFAULT '{}'::jsonb, -- Summary statistics
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    model_used VARCHAR(100), -- AI model that created summary
    confidence FLOAT DEFAULT 0.9,
    data_sources JSONB DEFAULT '{}'::jsonb, -- What data was summarized
    UNIQUE(branch_id, summary_date, summary_type) -- One summary per branch per day
);

-- Create indexes for daily_summaries
CREATE INDEX IF NOT EXISTS idx_daily_summaries_branch_id ON daily_summaries(branch_id);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_date ON daily_summaries(summary_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_type ON daily_summaries(summary_type);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_created_at ON daily_summaries(created_at DESC);

-- Function to automatically update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_entities_updated_at ON entities;
CREATE TRIGGER update_entities_updated_at 
    BEFORE UPDATE ON entities 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_relations_updated_at ON relations;
CREATE TRIGGER update_relations_updated_at 
    BEFORE UPDATE ON relations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_observations_updated_at ON observations;
CREATE TRIGGER update_observations_updated_at 
    BEFORE UPDATE ON observations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function for semantic search across observations
CREATE OR REPLACE FUNCTION search_observations_by_embedding(
    query_embedding vector(768),
    similarity_threshold float DEFAULT 0.3,
    result_limit integer DEFAULT 10,
    entity_filter text DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    entity_name VARCHAR(255),
    contents TEXT[],
    similarity FLOAT,
    timestamp TIMESTAMP WITH TIME ZONE,
    confidence FLOAT,
    tags TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        o.entity_name,
        o.contents,
        1 - (o.embedding <=> query_embedding) as similarity,
        o.timestamp,
        o.confidence,
        o.tags
    FROM observations o
    WHERE 
        (entity_filter IS NULL OR o.entity_name = entity_filter)
        AND o.embedding IS NOT NULL
        AND (1 - (o.embedding <=> query_embedding)) >= similarity_threshold
        AND (o.expires_at IS NULL OR o.expires_at > NOW())
    ORDER BY o.embedding <=> query_embedding
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired records
CREATE OR REPLACE FUNCTION cleanup_expired_memory_records()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Delete expired entities (cascade will handle relations/observations)
    WITH deleted_entities AS (
        DELETE FROM entities 
        WHERE expires_at IS NOT NULL AND expires_at <= NOW()
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted_entities;
    
    -- Delete expired relations
    DELETE FROM relations 
    WHERE expires_at IS NOT NULL AND expires_at <= NOW();
    
    -- Delete expired observations
    DELETE FROM observations 
    WHERE expires_at IS NOT NULL AND expires_at <= NOW();
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up expired records (if pg_cron is available)
-- This would typically be run by your application or a cron job
-- SELECT cron.schedule('cleanup-memory', '0 2 * * *', 'SELECT cleanup_expired_memory_records();');

-- Grant appropriate permissions (adjust for your user roles)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON entities TO authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON relations TO authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON observations TO authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON daily_summaries TO authenticated;

-- Row Level Security (RLS) policies (customize based on your auth system)
-- ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE relations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE observations ENABLE ROW LEVEL SECURITY;

-- Example RLS policies (customize for your needs)
-- CREATE POLICY "Users can access their own data" ON entities
--     FOR ALL USING (
--         access_controls->>'user_ids' ? auth.uid()::text OR
--         'general' = ANY(ARRAY(SELECT jsonb_array_elements_text(access_controls->'roles')))
--     );

COMMENT ON TABLE entities IS 'Business knowledge graph entities (suppliers, products, workers, etc.)';
COMMENT ON TABLE relations IS 'Relationships between business entities';
COMMENT ON TABLE observations IS 'Facts and notes about entities with vector embeddings for semantic search';
COMMENT ON TABLE daily_summaries IS 'AI-generated summaries for archival and business intelligence';

-- Insert some initial test data (optional)
-- INSERT INTO entities (name, entity_type, metadata) VALUES 
--     ('Magnolia_Supplier', 'supplier', '{"delivery_days": ["Tuesday", "Friday"], "reliability": "high"}'),
--     ('Whole_Chicken', 'product', '{"unit": "piece", "typical_bag_size": 10}')
-- ON CONFLICT (name) DO NOTHING;