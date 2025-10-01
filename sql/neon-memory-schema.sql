-- ================================================================
-- AI MEMORY SYSTEM SCHEMA FOR NEON DATABASE
-- Chicken Business MCP Server - Separated Architecture
-- Copy and paste this entire script into your Neon SQL Editor
-- ================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================================
-- CORE MEMORY TABLES
-- ================================================================

-- Memory entities table (main AI memory storage)
CREATE TABLE IF NOT EXISTS memory_entities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    type VARCHAR(100) NOT NULL,
    description TEXT,
    importance_score DECIMAL(3,2) DEFAULT 0.5 CHECK (importance_score >= 0 AND importance_score <= 1),
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deprecated')),
    created_by VARCHAR(100) DEFAULT 'system',
    ttl_hours INTEGER DEFAULT NULL -- NULL means no expiration
);

-- Memory relations table (connections between entities)
CREATE TABLE IF NOT EXISTS memory_relations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    from_entity_id UUID NOT NULL REFERENCES memory_entities(id) ON DELETE CASCADE,
    to_entity_id UUID NOT NULL REFERENCES memory_entities(id) ON DELETE CASCADE,
    relation_type VARCHAR(100) NOT NULL,
    strength DECIMAL(3,2) DEFAULT 0.5 CHECK (strength >= 0 AND strength <= 1),
    direction VARCHAR(20) DEFAULT 'bidirectional' CHECK (direction IN ('forward', 'backward', 'bidirectional')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_by VARCHAR(100) DEFAULT 'system',
    UNIQUE(from_entity_id, to_entity_id, relation_type)
);

-- Memory observations table (detailed observations about entities)
CREATE TABLE IF NOT EXISTS memory_observations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_id UUID NOT NULL REFERENCES memory_entities(id) ON DELETE CASCADE,
    observation_text TEXT NOT NULL,
    observation_type VARCHAR(50) DEFAULT 'general',
    confidence DECIMAL(3,2) DEFAULT 0.8 CHECK (confidence >= 0 AND confidence <= 1),
    source VARCHAR(100) DEFAULT 'user_input',
    context JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100) DEFAULT 'system'
);

-- ================================================================
-- AI INTERACTION TRACKING
-- ================================================================

-- AI conversation history
CREATE TABLE IF NOT EXISTS ai_conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    user_message TEXT NOT NULL,
    ai_response TEXT NOT NULL,
    model_used VARCHAR(100) NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    processing_time_ms INTEGER DEFAULT 0,
    confidence_score DECIMAL(3,2) DEFAULT 0.8,
    memory_entities_used UUID[] DEFAULT ARRAY[]::UUID[],
    context_window_used INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- AI decision logs (for learning and improvement)
CREATE TABLE IF NOT EXISTS ai_decisions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    decision_type VARCHAR(100) NOT NULL,
    context TEXT NOT NULL,
    decision_made TEXT NOT NULL,
    reasoning TEXT,
    confidence DECIMAL(3,2) DEFAULT 0.8,
    outcome VARCHAR(50), -- 'success', 'failure', 'partial', 'unknown'
    feedback_score INTEGER CHECK (feedback_score >= 1 AND feedback_score <= 5),
    learned_insight TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- ================================================================
-- VECTOR EMBEDDINGS CACHE
-- ================================================================

-- Vector embeddings cache (for faster retrieval)
CREATE TABLE IF NOT EXISTS vector_embeddings_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 of content
    content_text TEXT NOT NULL,
    embedding_model VARCHAR(100) NOT NULL,
    pinecone_id VARCHAR(255), -- Reference to Pinecone vector
    embedding_dimensions INTEGER DEFAULT 1536,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    usage_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'
);

-- ================================================================
-- PERFORMANCE & MONITORING
-- ================================================================

-- Memory system performance metrics
CREATE TABLE IF NOT EXISTS memory_performance_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,4) NOT NULL,
    metric_unit VARCHAR(20) DEFAULT 'count',
    measurement_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    context JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System health checks
CREATE TABLE IF NOT EXISTS system_health_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    component VARCHAR(100) NOT NULL, -- 'neon_db', 'pinecone', 'memory_system'
    status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'warning', 'error', 'critical')),
    message TEXT,
    response_time_ms INTEGER,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- ================================================================
-- INDEXES FOR PERFORMANCE
-- ================================================================

-- Memory entities indexes
CREATE INDEX IF NOT EXISTS idx_memory_entities_name ON memory_entities(name);
CREATE INDEX IF NOT EXISTS idx_memory_entities_type ON memory_entities(type);
CREATE INDEX IF NOT EXISTS idx_memory_entities_importance ON memory_entities(importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_memory_entities_accessed ON memory_entities(last_accessed DESC);
CREATE INDEX IF NOT EXISTS idx_memory_entities_created ON memory_entities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_entities_status ON memory_entities(status);
CREATE INDEX IF NOT EXISTS idx_memory_entities_tags ON memory_entities USING GIN(tags);

-- Memory relations indexes
CREATE INDEX IF NOT EXISTS idx_memory_relations_from ON memory_relations(from_entity_id);
CREATE INDEX IF NOT EXISTS idx_memory_relations_to ON memory_relations(to_entity_id);
CREATE INDEX IF NOT EXISTS idx_memory_relations_type ON memory_relations(relation_type);
CREATE INDEX IF NOT EXISTS idx_memory_relations_strength ON memory_relations(strength DESC);

-- Memory observations indexes
CREATE INDEX IF NOT EXISTS idx_memory_observations_entity ON memory_observations(entity_id);
CREATE INDEX IF NOT EXISTS idx_memory_observations_type ON memory_observations(observation_type);
CREATE INDEX IF NOT EXISTS idx_memory_observations_created ON memory_observations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_observations_confidence ON memory_observations(confidence DESC);

-- AI conversations indexes
CREATE INDEX IF NOT EXISTS idx_ai_conversations_session ON ai_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_created ON ai_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_model ON ai_conversations(model_used);

-- Vector cache indexes
CREATE INDEX IF NOT EXISTS idx_vector_cache_hash ON vector_embeddings_cache(content_hash);
CREATE INDEX IF NOT EXISTS idx_vector_cache_model ON vector_embeddings_cache(embedding_model);
CREATE INDEX IF NOT EXISTS idx_vector_cache_used ON vector_embeddings_cache(last_used DESC);

-- Performance metrics indexes
CREATE INDEX IF NOT EXISTS idx_performance_metrics_name ON memory_performance_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_time ON memory_performance_metrics(measurement_time DESC);

-- Health logs indexes
CREATE INDEX IF NOT EXISTS idx_health_logs_component ON system_health_logs(component);
CREATE INDEX IF NOT EXISTS idx_health_logs_status ON system_health_logs(status);
CREATE INDEX IF NOT EXISTS idx_health_logs_checked ON system_health_logs(checked_at DESC);

-- ================================================================
-- UTILITY FUNCTIONS
-- ================================================================

-- Function to update entity access tracking
CREATE OR REPLACE FUNCTION update_entity_access(entity_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE memory_entities 
    SET 
        access_count = access_count + 1,
        last_accessed = NOW(),
        updated_at = NOW()
    WHERE id = entity_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get related entities
CREATE OR REPLACE FUNCTION get_related_entities(entity_id UUID, max_results INTEGER DEFAULT 10)
RETURNS TABLE (
    related_entity_id UUID,
    related_entity_name VARCHAR(255),
    relation_type VARCHAR(100),
    strength DECIMAL(3,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN r.from_entity_id = entity_id THEN r.to_entity_id
            ELSE r.from_entity_id
        END as related_entity_id,
        e.name as related_entity_name,
        r.relation_type,
        r.strength
    FROM memory_relations r
    JOIN memory_entities e ON (
        e.id = CASE 
            WHEN r.from_entity_id = entity_id THEN r.to_entity_id
            ELSE r.from_entity_id
        END
    )
    WHERE r.from_entity_id = entity_id OR r.to_entity_id = entity_id
    ORDER BY r.strength DESC, e.importance_score DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old observations (TTL)
CREATE OR REPLACE FUNCTION cleanup_expired_entities()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Delete entities that have expired based on TTL
    DELETE FROM memory_entities 
    WHERE ttl_hours IS NOT NULL 
    AND created_at < NOW() - (ttl_hours || ' hours')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log cleanup activity
    INSERT INTO memory_performance_metrics (metric_name, metric_value, metric_unit, context)
    VALUES ('entities_cleaned_up', deleted_count, 'count', jsonb_build_object('cleanup_time', NOW()));
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get memory statistics
CREATE OR REPLACE FUNCTION get_memory_stats()
RETURNS TABLE (
    total_entities BIGINT,
    total_relations BIGINT,
    total_observations BIGINT,
    avg_importance DECIMAL(3,2),
    most_accessed_entity VARCHAR(255),
    database_size_mb DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_entities,
        (SELECT COUNT(*) FROM memory_relations) as total_relations,
        (SELECT COUNT(*) FROM memory_observations) as total_observations,
        AVG(importance_score) as avg_importance,
        (SELECT name FROM memory_entities ORDER BY access_count DESC LIMIT 1) as most_accessed_entity,
        (SELECT ROUND((pg_database_size(current_database()) / 1024.0 / 1024.0)::DECIMAL, 2)) as database_size_mb
    FROM memory_entities;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ================================================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to relevant tables
DROP TRIGGER IF EXISTS update_memory_entities_updated_at ON memory_entities;
CREATE TRIGGER update_memory_entities_updated_at
    BEFORE UPDATE ON memory_entities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_memory_relations_updated_at ON memory_relations;
CREATE TRIGGER update_memory_relations_updated_at
    BEFORE UPDATE ON memory_relations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- INITIAL DATA SETUP
-- ================================================================

-- Insert initial system entities
INSERT INTO memory_entities (name, type, description, importance_score, metadata) VALUES
('chicken_business_system', 'system', 'Core system entity for chicken business operations', 1.0, '{"role": "core_system", "version": "1.0"}'),
('customer_interactions', 'category', 'Category for all customer interaction memories', 0.9, '{"category": "interactions"}'),
('business_insights', 'category', 'Category for business intelligence and insights', 0.9, '{"category": "intelligence"}'),
('operational_patterns', 'category', 'Category for operational patterns and workflows', 0.8, '{"category": "operations"}')
ON CONFLICT (name) DO NOTHING;

-- Insert initial relations
INSERT INTO memory_relations (from_entity_id, to_entity_id, relation_type, strength)
SELECT 
    e1.id, e2.id, 'contains', 0.9
FROM memory_entities e1, memory_entities e2
WHERE e1.name = 'chicken_business_system' 
AND e2.name IN ('customer_interactions', 'business_insights', 'operational_patterns')
ON CONFLICT (from_entity_id, to_entity_id, relation_type) DO NOTHING;

-- Insert initial performance metrics
INSERT INTO memory_performance_metrics (metric_name, metric_value, metric_unit, context)
VALUES 
('system_initialized', 1, 'boolean', jsonb_build_object('init_time', NOW(), 'version', '1.0')),
('schema_version', 1.0, 'version', jsonb_build_object('created_at', NOW()));

-- ================================================================
-- COMMENTS FOR DOCUMENTATION
-- ================================================================

COMMENT ON TABLE memory_entities IS 'Core AI memory entities - stores main memory objects';
COMMENT ON TABLE memory_relations IS 'Relationships between memory entities';
COMMENT ON TABLE memory_observations IS 'Detailed observations and facts about entities';
COMMENT ON TABLE ai_conversations IS 'Log of AI conversations for learning and context';
COMMENT ON TABLE ai_decisions IS 'Decision logs for AI learning and improvement';
COMMENT ON TABLE vector_embeddings_cache IS 'Cache for vector embeddings to reduce API calls';
COMMENT ON TABLE memory_performance_metrics IS 'Performance metrics and monitoring data';
COMMENT ON TABLE system_health_logs IS 'System health monitoring logs';

COMMENT ON FUNCTION update_entity_access(UUID) IS 'Updates access count and timestamp for entity';
COMMENT ON FUNCTION get_related_entities(UUID, INTEGER) IS 'Gets related entities with relationship strength';
COMMENT ON FUNCTION cleanup_expired_entities() IS 'Cleans up entities that have exceeded their TTL';
COMMENT ON FUNCTION get_memory_stats() IS 'Returns comprehensive memory system statistics';

-- ================================================================
-- COMPLETION MESSAGE
-- ================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ AI Memory System schema successfully created!';
    RAISE NOTICE '📊 Tables created: % entities, % relations, % observations', 
        (SELECT COUNT(*) FROM memory_entities),
        (SELECT COUNT(*) FROM memory_relations), 
        (SELECT COUNT(*) FROM memory_observations);
    RAISE NOTICE '🔗 Database ready for AI memory operations';
END $$;