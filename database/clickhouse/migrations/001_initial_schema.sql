-- ClickHouse Initial Migration
-- Run this to setup the analytics database

-- Enable experimental features if needed
-- SET allow_experimental_object_type = 1;

-- Import main schema
-- Run: clickhouse-client --queries-file schema.sql

-- Initial data seeding for assets metadata
INSERT INTO assets_metadata (asset_id, symbol, name, class, currency) VALUES
('BRL', 'BRL', 'Real Brasileiro', 'currency', 'BRL'),
('USD', 'USD', 'Dólar Americano', 'currency', 'USD'),
('EUR', 'EUR', 'Euro', 'currency', 'EUR'),
('PETR4', 'PETR4', 'Petrobras PN', 'stock', 'BRL'),
('VALE3', 'VALE3', 'Vale ON', 'stock', 'BRL'),
('ITUB4', 'ITUB4', 'Itaú Unibanco PN', 'stock', 'BRL'),
('BBDC4', 'BBDC4', 'Bradesco PN', 'stock', 'BRL'),
('BTC', 'BTC', 'Bitcoin', 'crypto', 'USD'),
('ETH', 'ETH', 'Ethereum', 'crypto', 'USD'),
('HOUSE_01', 'CASA', 'Imóvel Residencial', 'real_estate', 'BRL'),
('CAR_01', 'CARRO', 'Veículo', 'other', 'BRL');

-- Create sample user data (for testing)
-- INSERT INTO events_stream (user_id, event_id, asset_id, timestamp, kind, units_delta, price_close) VALUES
-- ('test-user-1', 'evt-001', 'BRL', now(), 'deposit', 10000, 1.0),
-- ('test-user-1', 'evt-002', 'PETR4', now(), 'buy', 100, 25.50);

-- Verify installation
SELECT 'ClickHouse schema installed successfully!' as status;
SELECT count(*) as assets_count FROM assets_metadata;