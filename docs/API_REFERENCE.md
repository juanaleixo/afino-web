# API Reference - Afino Finance

## Overview

This document provides a comprehensive reference for all API endpoints and database functions available in the Afino Finance platform.

## Table of Contents

1. [Authentication](#authentication)
2. [Database Functions (RPC)](#database-functions-rpc)
3. [REST API Endpoints](#rest-api-endpoints)
4. [WebSocket Events](#websocket-events)
5. [Error Handling](#error-handling)

## Authentication

All API requests require authentication via Supabase Auth. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Database Functions (RPC)

### Portfolio Functions

#### `api_portfolio_daily`
Returns daily portfolio values for a user within a date range.

**Parameters:**
- `p_from` (date): Start date
- `p_to` (date): End date

**Returns:** Array of `{date: string, total_value: number}`

**Access:** Premium users only

**Example:**
```typescript
const { data, error } = await supabase.rpc('api_portfolio_daily', {
  p_from: '2024-01-01',
  p_to: '2024-01-31'
})
```

#### `api_portfolio_monthly`
Returns monthly portfolio values (last day of each month).

**Parameters:**
- `p_from` (date): Start date
- `p_to` (date): End date

**Returns:** Array of `{month_eom: string, total_value: number}`

**Access:** All users

#### `api_holdings_at`
Returns holdings snapshot for a specific date.

**Parameters:**
- `p_date` (date): Target date

**Returns:** Array of holdings with asset details

**Access:** All users (current date only for free users)

#### `api_holdings_accounts`
Returns holdings grouped by account and asset.

**Parameters:**
- `p_date` (date): Target date

**Returns:** Array of holdings with account grouping

**Access:** Premium users only

#### `api_holdings_with_assets`
Optimized version that includes asset metadata in a single query.

**Parameters:**
- `p_date` (date): Target date

**Returns:** Array of holdings with embedded asset data

**Access:** All users

### Portfolio Summary Functions

#### `api_portfolio_summary`
Returns comprehensive portfolio statistics.

**Parameters:**
- `p_date` (date): Target date

**Returns:** Object with total_value, cash_balance, assets_value, counts

**Access:** All users

#### `api_user_context`
Returns user profile and plan information.

**Parameters:** None

**Returns:** User profile with plan details

**Access:** All users

### Asset Functions

#### `api_assets_batch`
Batch fetch asset information by IDs.

**Parameters:**
- `p_asset_ids` (uuid[]): Array of asset IDs

**Returns:** Array of asset details

**Access:** All users

## REST API Endpoints

### Events

#### `GET /api/events`
List user events with optional filtering.

**Query Parameters:**
- `from` (date): Start date
- `to` (date): End date
- `asset_id` (uuid): Filter by asset
- `account_id` (uuid): Filter by account
- `kind` (string): Filter by event type

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "kind": "deposit|withdraw|buy|valuation",
      "tstamp": "2024-01-01T00:00:00Z",
      "units_delta": 100,
      "price_close": 25.50,
      "asset": {...},
      "account": {...}
    }
  ],
  "count": 100
}
```

#### `POST /api/events`
Create a new event.

**Request Body:**
```json
{
  "kind": "deposit|withdraw|buy|valuation",
  "asset_id": "uuid",
  "account_id": "uuid",
  "tstamp": "2024-01-01T00:00:00Z",
  "units_delta": 100,
  "price_close": 25.50
}
```

**Response:** Created event object

#### `DELETE /api/events/:id`
Delete an event.

**Response:** 204 No Content

### Accounts

#### `GET /api/accounts`
List user accounts.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "label": "Conta Principal",
      "currency": "BRL",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### `POST /api/accounts`
Create a new account.

**Request Body:**
```json
{
  "label": "Nova Conta",
  "currency": "BRL"
}
```

#### `PATCH /api/accounts/:id`
Update account details.

**Request Body:**
```json
{
  "label": "Nome Atualizado"
}
```

### Assets

#### `GET /api/assets`
List available assets (global + custom).

**Query Parameters:**
- `class` (string): Filter by asset class
- `search` (string): Search by symbol or name

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "symbol": "PETR4",
      "class": "stock",
      "label_ptbr": "Petrobras PN",
      "currency": "BRL",
      "manual_price": null
    }
  ]
}
```

## WebSocket Events

### Subscription Channels

#### `portfolio:changes`
Real-time portfolio value updates.

**Message Format:**
```json
{
  "type": "portfolio_update",
  "data": {
    "date": "2024-01-01",
    "total_value": 10000.00,
    "change_percent": 2.5
  }
}
```

#### `events:created`
New events created by the user.

**Message Format:**
```json
{
  "type": "event_created",
  "data": {
    "id": "uuid",
    "kind": "deposit",
    ...
  }
}
```

## Error Handling

### Error Response Format

All errors follow a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Additional error context
    }
  }
}
```

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `AUTH_REQUIRED` | Authentication required | 401 |
| `AUTH_INVALID` | Invalid authentication token | 401 |
| `PERMISSION_DENIED` | Insufficient permissions | 403 |
| `NOT_FOUND` | Resource not found | 404 |
| `VALIDATION_ERROR` | Request validation failed | 400 |
| `DUPLICATE_ENTRY` | Duplicate resource | 409 |
| `RATE_LIMITED` | Too many requests | 429 |
| `INTERNAL_ERROR` | Server error | 500 |

### Rate Limiting

API requests are rate-limited per user:
- **Free users**: 100 requests/minute
- **Premium users**: 1000 requests/minute

Rate limit headers:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp

## Best Practices

1. **Caching**: Use ETags and If-None-Match headers for efficient caching
2. **Pagination**: Use limit/offset for large datasets
3. **Batch Operations**: Use batch endpoints when fetching multiple resources
4. **Error Handling**: Always handle errors gracefully and check response status
5. **Date/Time**: All timestamps are in UTC. Convert to local timezone as needed

## SDK Examples

### JavaScript/TypeScript
```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Fetch portfolio data
const { data, error } = await supabase
  .rpc('api_portfolio_monthly', {
    p_from: '2024-01-01',
    p_to: '2024-12-31'
  })
```

### Python
```python
from supabase import create_client

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Fetch holdings
response = supabase.rpc('api_holdings_at', {
    'p_date': '2024-01-01'
}).execute()
```