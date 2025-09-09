-- Schema: pay
-- Description: Payment and subscription management schema

CREATE SCHEMA IF NOT EXISTS pay;

-- Grant permissions
GRANT USAGE ON SCHEMA pay TO postgres, anon, authenticated;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA pay GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA pay GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;