-- Partitioning optimization strategies

-- 1. EVENTS table partitioning recommendation
-- Events table grows rapidly and would benefit from partitioning
-- This is a migration script that should be run carefully in production

-- Create partitioned events table (for future implementation)
-- NOTE: This requires data migration and should be done during maintenance window

/*
-- Future optimization: Partition events by user_id hash for better distribution
CREATE TABLE public.events_partitioned (
    LIKE public.events INCLUDING ALL
) PARTITION BY HASH (user_id);

-- Create 8 partitions for user-based distribution
CREATE TABLE public.events_p0 PARTITION OF public.events_partitioned 
FOR VALUES WITH (modulus 8, remainder 0);

CREATE TABLE public.events_p1 PARTITION OF public.events_partitioned 
FOR VALUES WITH (modulus 8, remainder 1);

-- ... Continue for all 8 partitions
*/

-- 2. Global price daily optimization - Consider partitioning by date range
-- For tables with time-series data that grows continuously

/*
-- Future optimization: Partition global_price_daily by year
CREATE TABLE public.global_price_daily_partitioned (
    LIKE public.global_price_daily INCLUDING ALL
) PARTITION BY RANGE (date);

-- Create yearly partitions
CREATE TABLE public.global_price_daily_2024 PARTITION OF public.global_price_daily_partitioned
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE public.global_price_daily_2025 PARTITION OF public.global_price_daily_partitioned
FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
*/

-- 3. Ensure daily_positions_acct has proper partition maintenance
-- Create function to automatically create new partitions
CREATE OR REPLACE FUNCTION create_daily_positions_partition(partition_date date)
RETURNS void AS $$
DECLARE
    partition_name text;
    start_date text;
    end_date text;
BEGIN
    -- Calculate partition name and bounds
    partition_name := 'daily_positions_acct_' || to_char(partition_date, 'YYYY_MM');
    start_date := to_char(date_trunc('month', partition_date), 'YYYY-MM-DD');
    end_date := to_char(date_trunc('month', partition_date) + interval '1 month', 'YYYY-MM-DD');
    
    -- Create partition if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_class 
        WHERE relname = partition_name
    ) THEN
        EXECUTE format('
            CREATE TABLE public.%I PARTITION OF public.daily_positions_acct
            FOR VALUES FROM (%L) TO (%L)
        ', partition_name, start_date, end_date);
        
        RAISE NOTICE 'Created partition: %', partition_name;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create partitions for current and next 3 months
SELECT create_daily_positions_partition(CURRENT_DATE);
SELECT create_daily_positions_partition(CURRENT_DATE + interval '1 month');
SELECT create_daily_positions_partition(CURRENT_DATE + interval '2 months');
SELECT create_daily_positions_partition(CURRENT_DATE + interval '3 months');

-- 4. Monitoring and maintenance recommendations
CREATE OR REPLACE FUNCTION get_table_sizes()
RETURNS TABLE(
    table_name text,
    size_mb numeric,
    row_count bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname||'.'||tablename as table_name,
        round((pg_total_relation_size(schemaname||'.'||tablename) / 1024 / 1024)::numeric, 2) as size_mb,
        n_tup_ins - n_tup_del as row_count
    FROM pg_stat_user_tables 
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
END;
$$ LANGUAGE plpgsql;

-- Usage: SELECT * FROM get_table_sizes();

SELECT 'Partitioning optimization strategies implemented successfully' as status;