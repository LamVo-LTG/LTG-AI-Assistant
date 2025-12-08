-- =====================================================
-- AI Chatbot PostgreSQL Database Setup Script
-- Database Name: ltg_assistant_v1
-- PostgreSQL Version: 14+
-- Created: 2025-10-23
-- =====================================================

-- =====================================================
-- 1. DATABASE SETUP
-- =====================================================

-- Connect to PostgreSQL and create database
-- Note: Run this as a superuser (postgres)
CREATE DATABASE ltg_assistant_v1
    WITH ENCODING 'UTF8'
    LC_COLLATE='en_US.UTF-8'
    LC_CTYPE='en_US.UTF-8'
    TEMPLATE=template0;

-- Connect to the new database
-- NOTE: If using pgAdmin, manually connect to ltg_assistant_v1 database before running the rest of this script
-- If using psql command line, this \c command will work: \c ltg_assistant_v1
-- For pgAdmin: Skip the CREATE DATABASE section and run this script after connecting to ltg_assistant_v1

-- =====================================================

-- IMPORTANT INSTRUCTIONS:
-- 1. First, create the database manually in pgAdmin:
--    Right-click on "Databases" → Create → Database
--    Database name: ltg_assistant_v1
--    Encoding: UTF8
--    Click "Save"
--
-- 2. Connect to the ltg_assistant_v1 database:
--    Click on ltg_assistant_v1 database in the left panel
--
-- 3. Open Query Tool:
--    Right-click on ltg_assistant_v1 → Query Tool
--
-- 4. Execute this entire script (F5)

-- =====================================================

-- =====================================================
-- 2. EXTENSIONS
-- =====================================================

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Trigram matching for Vietnamese text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Statistics for query performance monitoring
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- =====================================================
-- 3. CORE TABLES
-- =====================================================

-- -----------------------------------------------------
-- Users & Authentication
-- -----------------------------------------------------

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    avatar_url TEXT,
    preferences JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    last_login_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT valid_role CHECK (role IN ('admin', 'user')),
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_active ON users(is_active) WHERE deleted_at IS NULL;

COMMENT ON TABLE users IS 'User accounts with role-based access control';
COMMENT ON COLUMN users.preferences IS 'User preferences stored as JSONB (theme, language, default model, etc.)';

-- -----------------------------------------------------
-- System Prompts
-- -----------------------------------------------------

CREATE TABLE system_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    prompt_text TEXT NOT NULL,
    is_public BOOLEAN DEFAULT false,
    is_system BOOLEAN DEFAULT false,
    category VARCHAR(100),
    tags TEXT[] DEFAULT '{}',
    usage_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT prompt_text_not_empty CHECK (char_length(prompt_text) > 0)
);

CREATE INDEX idx_prompts_user ON system_prompts(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_prompts_public ON system_prompts(is_public) WHERE deleted_at IS NULL AND is_public = true;
CREATE INDEX idx_prompts_category ON system_prompts(category) WHERE deleted_at IS NULL;
CREATE INDEX idx_prompts_tags ON system_prompts USING GIN(tags);

COMMENT ON TABLE system_prompts IS 'User-created and shared system prompts';
COMMENT ON COLUMN system_prompts.name IS 'Prompt name - use application-layer search or LIKE/ILIKE for Vietnamese text';
COMMENT ON COLUMN system_prompts.description IS 'Prompt description - use application-layer search or LIKE/ILIKE for Vietnamese text';
COMMENT ON COLUMN system_prompts.is_system IS 'System-provided prompts (cannot be deleted by users)';

-- -----------------------------------------------------
-- Prompt Shares
-- -----------------------------------------------------

CREATE TABLE prompt_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_id UUID NOT NULL REFERENCES system_prompts(id) ON DELETE CASCADE,
    shared_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shared_with_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    permission VARCHAR(50) NOT NULL DEFAULT 'view',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_permission CHECK (permission IN ('view', 'edit', 'admin')),
    UNIQUE(prompt_id, shared_with_user_id)
);

CREATE INDEX idx_shares_prompt ON prompt_shares(prompt_id);
CREATE INDEX idx_shares_user ON prompt_shares(shared_with_user_id);

COMMENT ON TABLE prompt_shares IS 'Sharing permissions for system prompts';
COMMENT ON COLUMN prompt_shares.shared_with_user_id IS 'NULL means shared with all users';

-- -----------------------------------------------------
-- Conversations
-- -----------------------------------------------------

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL DEFAULT 'New Conversation',
    mode VARCHAR(50) NOT NULL,
    system_prompt_id UUID REFERENCES system_prompts(id) ON DELETE SET NULL,
    custom_prompt TEXT,
    is_pinned BOOLEAN DEFAULT false,
    model_name VARCHAR(100),
    temperature DECIMAL(3,2),
    max_tokens INTEGER,
    metadata JSONB DEFAULT '{}',
    total_messages INTEGER DEFAULT 0,
    total_tokens_used INTEGER DEFAULT 0,
    last_message_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT valid_mode CHECK (mode IN ('ai_agent', 'custom_prompt', 'url_context')),
    CONSTRAINT valid_temperature CHECK (temperature >= 0 AND temperature <= 2),
    CONSTRAINT prompt_required CHECK (
        (mode = 'custom_prompt') OR
        (mode = 'ai_agent' AND system_prompt_id IS NOT NULL) OR
        mode = 'url_context'
    )
);

CREATE INDEX idx_conversations_user ON conversations(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_conversations_mode ON conversations(mode) WHERE deleted_at IS NULL;
CREATE INDEX idx_conversations_pinned ON conversations(user_id, is_pinned) WHERE deleted_at IS NULL AND is_pinned = true;
CREATE INDEX idx_conversations_last_message ON conversations(user_id, last_message_at DESC) WHERE deleted_at IS NULL;

COMMENT ON TABLE conversations IS 'Chat sessions with different modes';
COMMENT ON COLUMN conversations.mode IS 'Chat mode: ai_agent, custom_prompt, url_context';
COMMENT ON COLUMN conversations.title IS 'Conversation title - use application-layer search or LIKE/ILIKE for Vietnamese text';
COMMENT ON COLUMN conversations.metadata IS 'Additional settings like context window, response format, etc.';

-- -----------------------------------------------------
-- Messages
-- -----------------------------------------------------

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    input_tokens_used INTEGER,
    output_tokens_used INTEGER,
    model_used VARCHAR(100),
    finish_reason VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    edited_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT valid_role CHECK (role IN ('user', 'assistant', 'system', 'function')),
    CONSTRAINT content_not_empty CHECK (char_length(content) > 0)
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_messages_role ON messages(conversation_id, role) WHERE deleted_at IS NULL;
CREATE INDEX idx_messages_created ON messages(created_at DESC);

COMMENT ON TABLE messages IS 'Individual messages within conversations';
COMMENT ON COLUMN messages.content IS 'Message content - use application-layer search or external search service for Vietnamese text';
COMMENT ON COLUMN messages.input_tokens_used IS 'Number of tokens in the input/prompt';
COMMENT ON COLUMN messages.output_tokens_used IS 'Number of tokens in the AI response/completion';
COMMENT ON COLUMN messages.metadata IS 'Additional data like attachments, citations, function calls, etc.';

-- -----------------------------------------------------
-- Resources (URLs & Files)
-- -----------------------------------------------------

CREATE TABLE resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_type VARCHAR(50) NOT NULL,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    file_path TEXT,
    file_size BIGINT,
    mime_type VARCHAR(100),
    url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT valid_resource_type CHECK (resource_type IN ('url', 'file')),
    CONSTRAINT resource_data_check CHECK (
        (resource_type = 'url' AND url IS NOT NULL) OR
        (resource_type = 'file' AND file_path IS NOT NULL)
    )
);

CREATE INDEX idx_resources_user ON resources(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_resources_type ON resources(resource_type) WHERE deleted_at IS NULL;

COMMENT ON TABLE resources IS 'URLs and files used in conversations';
COMMENT ON COLUMN resources.metadata IS 'File metadata like file count, word count, language, etc.';

-- -----------------------------------------------------
-- Conversation Resources (Junction Table)
-- -----------------------------------------------------

CREATE TABLE conversation_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(conversation_id, resource_id)
);

CREATE INDEX idx_conv_resources_conversation ON conversation_resources(conversation_id);
CREATE INDEX idx_conv_resources_resource ON conversation_resources(resource_id);

COMMENT ON TABLE conversation_resources IS 'Links resources (URLs, files) to conversations';

-- -----------------------------------------------------
-- AI Configuration
-- -----------------------------------------------------

CREATE TABLE ai_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    config_name VARCHAR(255) NOT NULL,
    provider VARCHAR(100) NOT NULL DEFAULT 'google_gemini',
    model_name VARCHAR(100) NOT NULL,
    default_temperature DECIMAL(3,2) DEFAULT 0.7,
    default_max_tokens INTEGER DEFAULT 2048,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT valid_provider CHECK (provider IN ('google_gemini', 'openai', 'anthropic', 'other')),
    CONSTRAINT valid_temperature_config CHECK (default_temperature >= 0 AND default_temperature <= 2)
);

CREATE INDEX idx_ai_config_user ON ai_configurations(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ai_config_default ON ai_configurations(user_id, is_default) WHERE deleted_at IS NULL AND is_default = true;

COMMENT ON TABLE ai_configurations IS 'AI API configurations';
COMMENT ON COLUMN ai_configurations.user_id IS 'NULL for system-wide default configuration';

-- -----------------------------------------------------
-- API Usage Logs
-- -----------------------------------------------------

CREATE TABLE api_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    ai_config_id UUID REFERENCES ai_configurations(id) ON DELETE SET NULL,
    provider VARCHAR(100) NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    cost_estimate DECIMAL(10, 6),
    response_time_ms INTEGER,
    status VARCHAR(50) NOT NULL,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_status CHECK (status IN ('success', 'error', 'timeout', 'rate_limited'))
);

CREATE INDEX idx_usage_user ON api_usage_logs(user_id, created_at DESC);
CREATE INDEX idx_usage_conversation ON api_usage_logs(conversation_id);
CREATE INDEX idx_usage_status ON api_usage_logs(status, created_at DESC);
CREATE INDEX idx_usage_date ON api_usage_logs(created_at DESC);

COMMENT ON TABLE api_usage_logs IS 'Track API usage for analytics and billing';
COMMENT ON COLUMN api_usage_logs.cost_estimate IS 'Estimated cost in USD';

-- -----------------------------------------------------
-- User Favorites
-- -----------------------------------------------------

CREATE TABLE user_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    favoritable_type VARCHAR(50) NOT NULL,
    favoritable_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_favoritable_type CHECK (favoritable_type IN ('conversation', 'prompt', 'resource')),
    UNIQUE(user_id, favoritable_type, favoritable_id)
);

CREATE INDEX idx_favorites_user ON user_favorites(user_id, favoritable_type);
CREATE INDEX idx_favorites_item ON user_favorites(favoritable_type, favoritable_id);

COMMENT ON TABLE user_favorites IS 'User favorites for conversations, prompts, and resources';

-- -----------------------------------------------------
-- Tags
-- -----------------------------------------------------

CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_color CHECK (color ~* '^#[0-9A-F]{6}$'),
    UNIQUE(user_id, name)
);

CREATE INDEX idx_tags_user ON tags(user_id);

COMMENT ON TABLE tags IS 'User-created tags for organization';
COMMENT ON COLUMN tags.user_id IS 'NULL for system tags';

-- -----------------------------------------------------
-- Conversation Tags (Junction Table)
-- -----------------------------------------------------

CREATE TABLE conversation_tags (
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (conversation_id, tag_id)
);

CREATE INDEX idx_conv_tags_conversation ON conversation_tags(conversation_id);
CREATE INDEX idx_conv_tags_tag ON conversation_tags(tag_id);

COMMENT ON TABLE conversation_tags IS 'Tags applied to conversations';

-- =====================================================
-- 4. AUDIT LOGGING
-- =====================================================

-- Note: Audit logging has been removed from this setup
-- You can add it later if needed for compliance requirements

-- =====================================================
-- 5. TRIGGERS
-- =====================================================

-- Update updated_at timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_prompts_updated_at BEFORE UPDATE ON system_prompts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resources_updated_at BEFORE UPDATE ON resources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_configurations_updated_at BEFORE UPDATE ON ai_configurations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 6. SEED DATA
-- =====================================================

-- Create default admin user
-- Password: Admin@123 (bcrypt hash - CHANGE IN PRODUCTION!)
INSERT INTO users (email, password_hash, username, full_name, role, email_verified, is_active)
VALUES (
    'admin@ltgassistant.com',
    '$2b$10$YourBcryptHashHere',  -- Replace with actual bcrypt hash
    'admin',
    'System Administrator',
    'admin',
    true,
    true
);

-- Create default system prompts
INSERT INTO system_prompts (user_id, name, description, prompt_text, is_public, is_system, category)
VALUES
(
    (SELECT id FROM users WHERE email = 'admin@ltgassistant.com'),
    'General Assistant',
    'A helpful, harmless, and honest AI assistant for general purposes',
    'You are a helpful AI assistant. Provide clear, accurate, and concise responses to user questions. Be polite, professional, and helpful.',
    true,
    true,
    'general'
),
(
    (SELECT id FROM users WHERE email = 'admin@ltgassistant.com'),
    'Code Helper',
    'Specialized assistant for programming and software development',
    'You are an expert programming assistant. Help users write clean, efficient, and well-documented code. Explain technical concepts clearly and provide best practices.',
    true,
    true,
    'coding'
),
(
    (SELECT id FROM users WHERE email = 'admin@ltgassistant.com'),
    'Vietnamese Tutor',
    'Vietnamese language learning assistant',
    'Bạn là một trợ lý dạy tiếng Việt. Hãy giúp người dùng học tiếng Việt một cách hiệu quả, giải thích ngữ pháp, từ vựng và cung cấp ví dụ thực tế.',
    true,
    true,
    'education'
);

-- Create default AI configuration
INSERT INTO ai_configurations (user_id, config_name, provider, model_name, default_temperature, default_max_tokens, is_default, is_active)
VALUES
(
    NULL,  -- System-wide configuration
    'Default Google Gemini',
    'google_gemini',
    'gemini-pro',
    0.7,
    2048,
    true,
    true
);

-- =====================================================
-- 7. PERMISSIONS & SECURITY
-- =====================================================

-- Note: Row-Level Security (RLS) can be added later based on application requirements
-- Example RLS policies are documented in the schema design document

-- =====================================================
-- 8. MATERIALIZED VIEWS FOR ANALYTICS
-- =====================================================

-- User statistics materialized view
CREATE MATERIALIZED VIEW user_statistics AS
SELECT
    u.id AS user_id,
    u.email,
    u.username,
    COUNT(DISTINCT c.id) AS total_conversations,
    COUNT(DISTINCT m.id) AS total_messages,
    COALESCE(SUM(c.total_tokens_used), 0) AS total_tokens,
    MAX(m.created_at) AS last_activity,
    COUNT(DISTINCT sp.id) AS created_prompts,
    u.created_at AS user_since
FROM users u
LEFT JOIN conversations c ON u.id = c.user_id AND c.deleted_at IS NULL
LEFT JOIN messages m ON c.id = m.conversation_id AND m.deleted_at IS NULL
LEFT JOIN system_prompts sp ON u.id = sp.user_id AND sp.deleted_at IS NULL
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.email, u.username, u.created_at;

CREATE UNIQUE INDEX ON user_statistics(user_id);

COMMENT ON MATERIALIZED VIEW user_statistics IS 'Aggregated user statistics for admin dashboard';

-- =====================================================
-- SETUP COMPLETE
-- =====================================================

-- Display setup summary
SELECT
    'Database setup completed successfully!' AS status,
    'ltg_assistant_v1' AS database_name,
    COUNT(*) AS total_tables
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE';

-- Display created tables
SELECT
    table_name,
    (SELECT COUNT(*)
     FROM information_schema.columns
     WHERE columns.table_schema = tables.table_schema
         AND columns.table_name = tables.table_name
    ) AS column_count
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Display created indexes
SELECT
    schemaname,
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- =====================================================
-- NOTES
-- =====================================================

-- 1. Remember to update the default admin password hash before deploying
-- 2. Configure PostgreSQL settings for optimal performance (postgresql.conf)
-- 3. Set up regular backups using pg_dump or continuous archiving
-- 4. Monitor query performance using pg_stat_statements
-- 5. Refresh materialized views regularly (schedule with cron or pg_cron)
-- 6. Consider setting up connection pooling (PgBouncer) for production
-- 7. For Vietnamese text search, consider external search services (Elasticsearch, Meilisearch)
-- 8. Enable SSL/TLS for database connections in production

-- =====================================================
-- END OF SETUP SCRIPT
-- =====================================================
