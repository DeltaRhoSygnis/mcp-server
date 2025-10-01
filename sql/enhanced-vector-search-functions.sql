-- Enhanced Vector Search Functions
-- Advanced vector search capabilities with cross-collection support

-- Create vector search function for notes with advanced similarity
CREATE OR REPLACE FUNCTION vector_search_notes(
    query_embedding vector(1536),
    similarity_threshold float DEFAULT 0.3,
    match_count int DEFAULT 20
)
RETURNS TABLE (
    id uuid,
    content text,
    similarity float,
    category text,
    branch_id uuid,
    created_at timestamptz,
    importance_score float,
    tags text[],
    surrounding_content text,
    related_items text[]
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.id,
        n.content,
        (1 - (n.embedding <=> query_embedding)) as similarity,
        n.category,
        n.branch_id,
        n.created_at,
        COALESCE(n.importance_score, 0.5)::float as importance_score,
        COALESCE(n.tags, ARRAY[]::text[]) as tags,
        n.content as surrounding_content, -- Could be enhanced with actual surrounding context
        ARRAY[]::text[] as related_items -- Placeholder for related items
    FROM notes n
    WHERE 
        n.embedding IS NOT NULL
        AND (1 - (n.embedding <=> query_embedding)) > similarity_threshold
    ORDER BY n.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Create vector search function for memories
CREATE OR REPLACE FUNCTION vector_search_memories(
    query_embedding vector(1536),
    similarity_threshold float DEFAULT 0.3,
    match_count int DEFAULT 20
)
RETURNS TABLE (
    id uuid,
    content text,
    similarity float,
    category text,
    branch_id uuid,
    created_at timestamptz,
    importance_score float,
    tags text[],
    surrounding_content text,
    related_items text[]
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.observation as content,
        (1 - (m.embedding <=> query_embedding)) as similarity,
        'memory'::text as category,
        NULL::uuid as branch_id, -- Memories might not have branch_id
        m.created_at,
        COALESCE(m.importance, 0.5)::float as importance_score,
        ARRAY[]::text[] as tags, -- Placeholder
        m.observation as surrounding_content,
        ARRAY[]::text[] as related_items
    FROM memories m
    WHERE 
        m.embedding IS NOT NULL
        AND (1 - (m.embedding <=> query_embedding)) > similarity_threshold
    ORDER BY m.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Create vector search function for operations
CREATE OR REPLACE FUNCTION vector_search_operations(
    query_embedding vector(1536),
    similarity_threshold float DEFAULT 0.3,
    match_count int DEFAULT 20
)
RETURNS TABLE (
    id uuid,
    content text,
    similarity float,
    category text,
    branch_id uuid,
    created_at timestamptz,
    importance_score float,
    tags text[],
    surrounding_content text,
    related_items text[]
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        CONCAT(COALESCE(o.operation_type, ''), ': ', COALESCE(o.description, '')) as content,
        (1 - (o.embedding <=> query_embedding)) as similarity,
        o.operation_type as category,
        o.branch_id,
        o.created_at,
        0.5::float as importance_score, -- Default importance for operations
        ARRAY[]::text[] as tags,
        COALESCE(o.description, '') as surrounding_content,
        ARRAY[]::text[] as related_items
    FROM operations o
    WHERE 
        o.embedding IS NOT NULL
        AND (1 - (o.embedding <=> query_embedding)) > similarity_threshold
    ORDER BY o.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Create vector search function for expenses
CREATE OR REPLACE FUNCTION vector_search_expenses(
    query_embedding vector(1536),
    similarity_threshold float DEFAULT 0.3,
    match_count int DEFAULT 20
)
RETURNS TABLE (
    id uuid,
    content text,
    similarity float,
    category text,
    branch_id uuid,
    created_at timestamptz,
    importance_score float,
    tags text[],
    surrounding_content text,
    related_items text[]
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        CONCAT(COALESCE(e.category, ''), ': ', COALESCE(e.description, ''), ' - ', COALESCE(e.amount::text, '0'), ' PHP') as content,
        (1 - (e.embedding <=> query_embedding)) as similarity,
        e.category,
        e.branch_id,
        e.created_at,
        0.3::float as importance_score, -- Lower default importance for expenses
        ARRAY[]::text[] as tags,
        COALESCE(e.description, '') as surrounding_content,
        ARRAY[]::text[] as related_items
    FROM expenses e
    WHERE 
        e.embedding IS NOT NULL
        AND (1 - (e.embedding <=> query_embedding)) > similarity_threshold
    ORDER BY e.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Create cross-collection similarity search function
CREATE OR REPLACE FUNCTION cross_collection_similarity(
    source_embedding vector(1536),
    target_tables text[] DEFAULT ARRAY['notes', 'memories', 'operations', 'expenses'],
    similarity_threshold float DEFAULT 0.4,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    collection text,
    id uuid,
    content text,
    similarity float,
    category text,
    branch_id uuid,
    created_at timestamptz
) 
LANGUAGE plpgsql
AS $$
DECLARE
    table_name text;
    query_text text;
BEGIN
    -- Create a temporary table to collect results
    CREATE TEMP TABLE IF NOT EXISTS temp_similarity_results (
        collection text,
        id uuid,
        content text,
        similarity float,
        category text,
        branch_id uuid,
        created_at timestamptz
    );

    -- Search each specified table
    FOREACH table_name IN ARRAY target_tables
    LOOP
        CASE table_name
            WHEN 'notes' THEN
                INSERT INTO temp_similarity_results
                SELECT 
                    'notes'::text,
                    n.id,
                    n.content,
                    (1 - (n.embedding <=> source_embedding)) as similarity,
                    n.category,
                    n.branch_id,
                    n.created_at
                FROM notes n
                WHERE 
                    n.embedding IS NOT NULL
                    AND (1 - (n.embedding <=> source_embedding)) > similarity_threshold;

            WHEN 'memories' THEN
                INSERT INTO temp_similarity_results
                SELECT 
                    'memories'::text,
                    m.id,
                    m.observation,
                    (1 - (m.embedding <=> source_embedding)) as similarity,
                    'memory'::text,
                    NULL::uuid,
                    m.created_at
                FROM memories m
                WHERE 
                    m.embedding IS NOT NULL
                    AND (1 - (m.embedding <=> source_embedding)) > similarity_threshold;

            WHEN 'operations' THEN
                INSERT INTO temp_similarity_results
                SELECT 
                    'operations'::text,
                    o.id,
                    CONCAT(COALESCE(o.operation_type, ''), ': ', COALESCE(o.description, '')),
                    (1 - (o.embedding <=> source_embedding)) as similarity,
                    o.operation_type,
                    o.branch_id,
                    o.created_at
                FROM operations o
                WHERE 
                    o.embedding IS NOT NULL
                    AND (1 - (o.embedding <=> source_embedding)) > similarity_threshold;

            WHEN 'expenses' THEN
                INSERT INTO temp_similarity_results
                SELECT 
                    'expenses'::text,
                    e.id,
                    CONCAT(COALESCE(e.category, ''), ': ', COALESCE(e.description, ''), ' - ', COALESCE(e.amount::text, '0'), ' PHP'),
                    (1 - (e.embedding <=> source_embedding)) as similarity,
                    e.category,
                    e.branch_id,
                    e.created_at
                FROM expenses e
                WHERE 
                    e.embedding IS NOT NULL
                    AND (1 - (e.embedding <=> source_embedding)) > similarity_threshold;
        END CASE;
    END LOOP;

    -- Return sorted results
    RETURN QUERY
    SELECT * FROM temp_similarity_results
    ORDER BY similarity DESC
    LIMIT match_count;

    -- Clean up
    DROP TABLE IF EXISTS temp_similarity_results;
END;
$$;

-- Create function to get vector search statistics
CREATE OR REPLACE FUNCTION get_vector_search_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    WITH search_stats AS (
        SELECT 
            'notes' as table_name,
            COUNT(*) as total_items,
            COUNT(*) FILTER (WHERE embedding IS NOT NULL) as items_with_embeddings,
            AVG(array_length(embedding, 1)) as avg_embedding_dimension
        FROM notes
        
        UNION ALL
        
        SELECT 
            'memories' as table_name,
            COUNT(*) as total_items,
            COUNT(*) FILTER (WHERE embedding IS NOT NULL) as items_with_embeddings,
            AVG(array_length(embedding, 1)) as avg_embedding_dimension
        FROM memories
        
        UNION ALL
        
        SELECT 
            'operations' as table_name,
            COUNT(*) as total_items,
            COUNT(*) FILTER (WHERE embedding IS NOT NULL) as items_with_embeddings,
            AVG(array_length(embedding, 1)) as avg_embedding_dimension
        FROM operations
        
        UNION ALL
        
        SELECT 
            'expenses' as table_name,
            COUNT(*) as total_items,
            COUNT(*) FILTER (WHERE embedding IS NOT NULL) as items_with_embeddings,
            AVG(array_length(embedding, 1)) as avg_embedding_dimension
        FROM expenses
    )
    SELECT json_object_agg(
        table_name,
        json_build_object(
            'totalItems', total_items,
            'itemsWithEmbeddings', items_with_embeddings,
            'embeddingCoverage', CASE 
                WHEN total_items > 0 THEN ROUND((items_with_embeddings::NUMERIC / total_items) * 100, 2)
                ELSE 0 
            END,
            'avgEmbeddingDimension', COALESCE(avg_embedding_dimension, 0)
        )
    ) INTO result
    FROM search_stats;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create function to find similar items within a collection
CREATE OR REPLACE FUNCTION find_similar_in_collection(
    collection_name text,
    item_id uuid,
    similarity_threshold float DEFAULT 0.5,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id uuid,
    content text,
    similarity float,
    category text,
    created_at timestamptz
) 
LANGUAGE plpgsql
AS $$
DECLARE
    source_embedding vector(1536);
BEGIN
    -- Get the embedding of the source item
    CASE collection_name
        WHEN 'notes' THEN
            SELECT embedding INTO source_embedding FROM notes WHERE notes.id = item_id;
        WHEN 'memories' THEN
            SELECT embedding INTO source_embedding FROM memories WHERE memories.id = item_id;
        WHEN 'operations' THEN
            SELECT embedding INTO source_embedding FROM operations WHERE operations.id = item_id;
        WHEN 'expenses' THEN
            SELECT embedding INTO source_embedding FROM expenses WHERE expenses.id = item_id;
        ELSE
            RAISE EXCEPTION 'Invalid collection name: %', collection_name;
    END CASE;

    IF source_embedding IS NULL THEN
        RAISE EXCEPTION 'Source item not found or has no embedding: %', item_id;
    END IF;

    -- Find similar items in the same collection
    CASE collection_name
        WHEN 'notes' THEN
            RETURN QUERY
            SELECT 
                n.id,
                n.content,
                (1 - (n.embedding <=> source_embedding)) as similarity,
                n.category,
                n.created_at
            FROM notes n
            WHERE 
                n.id != item_id
                AND n.embedding IS NOT NULL
                AND (1 - (n.embedding <=> source_embedding)) > similarity_threshold
            ORDER BY n.embedding <=> source_embedding
            LIMIT match_count;

        WHEN 'memories' THEN
            RETURN QUERY
            SELECT 
                m.id,
                m.observation as content,
                (1 - (m.embedding <=> source_embedding)) as similarity,
                'memory'::text as category,
                m.created_at
            FROM memories m
            WHERE 
                m.id != item_id
                AND m.embedding IS NOT NULL
                AND (1 - (m.embedding <=> source_embedding)) > similarity_threshold
            ORDER BY m.embedding <=> source_embedding
            LIMIT match_count;

        WHEN 'operations' THEN
            RETURN QUERY
            SELECT 
                o.id,
                CONCAT(COALESCE(o.operation_type, ''), ': ', COALESCE(o.description, '')) as content,
                (1 - (o.embedding <=> source_embedding)) as similarity,
                o.operation_type as category,
                o.created_at
            FROM operations o
            WHERE 
                o.id != item_id
                AND o.embedding IS NOT NULL
                AND (1 - (o.embedding <=> source_embedding)) > similarity_threshold
            ORDER BY o.embedding <=> source_embedding
            LIMIT match_count;

        WHEN 'expenses' THEN
            RETURN QUERY
            SELECT 
                e.id,
                CONCAT(COALESCE(e.category, ''), ': ', COALESCE(e.description, '')) as content,
                (1 - (e.embedding <=> source_embedding)) as similarity,
                e.category,
                e.created_at
            FROM expenses e
            WHERE 
                e.id != item_id
                AND e.embedding IS NOT NULL
                AND (1 - (e.embedding <=> source_embedding)) > similarity_threshold
            ORDER BY e.embedding <=> source_embedding
            LIMIT match_count;
    END CASE;
END;
$$;

-- Create indexes for better vector search performance
CREATE INDEX IF NOT EXISTS idx_notes_embedding_cosine ON notes USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_memories_embedding_cosine ON memories USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_operations_embedding_cosine ON operations USING ivfflat (embedding vector_cosine_ops) WHERE embedding IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_embedding_cosine ON expenses USING ivfflat (embedding vector_cosine_ops) WHERE embedding IS NOT NULL;

-- Create composite indexes for filtered vector searches
CREATE INDEX IF NOT EXISTS idx_notes_branch_embedding ON notes(branch_id) WHERE embedding IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notes_category_embedding ON notes(category) WHERE embedding IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_operations_branch_embedding ON operations(branch_id) WHERE embedding IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_branch_embedding ON expenses(branch_id) WHERE embedding IS NOT NULL;

COMMENT ON FUNCTION vector_search_notes IS 'Advanced vector similarity search for notes with metadata';
COMMENT ON FUNCTION vector_search_memories IS 'Advanced vector similarity search for memories with metadata';
COMMENT ON FUNCTION vector_search_operations IS 'Advanced vector similarity search for operations with metadata';
COMMENT ON FUNCTION vector_search_expenses IS 'Advanced vector similarity search for expenses with metadata';
COMMENT ON FUNCTION cross_collection_similarity IS 'Find similar items across multiple collections based on source embedding';
COMMENT ON FUNCTION get_vector_search_stats IS 'Get statistics about vector search capabilities and embedding coverage';
COMMENT ON FUNCTION find_similar_in_collection IS 'Find similar items within the same collection as a source item';