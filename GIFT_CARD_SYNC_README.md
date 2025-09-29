# Gift Card Sync System

This document describes the new gift card synchronization system that automatically fetches and stores gift card data from the Reloadly API.

## Overview

The gift card sync system consists of:
1. A MongoDB model to store gift card data with flexible schema
2. A cron job that runs daily to sync data from Reloadly API
3. Updated API endpoints that use the database instead of making direct API calls
4. Manual sync and statistics endpoints

## Components

### 1. Gift Card Model (`models/giftCards.js`)
- **Flexible Schema**: Uses `mongoose.Schema.Types.Mixed` to store entire product data
- **Future-Proof**: Automatically captures new fields from Reloadly API without schema changes
- **Key Fields**:
  - `productId`: Unique identifier (required, indexed)
  - `data`: Complete product data from Reloadly API (flexible)
  - `isActive`: Sync status flag
  - `lastSynced`: Timestamp of last sync
- **Indexes**: Optimized for queries on productId, brandId, countryCode, and text search

### 2. Sync Service (`utils/giftCardSync.js`)
- Handles authentication with Reloadly API
- Fetches all gift card products
- Stores complete product data in the `data` field
- Syncs data to MongoDB using upsert operations
- Runs as a cron job daily at 2:00 AM WAT
- Provides manual sync functionality

### 3. Updated API Endpoints
- `GET /api/bills/giftcard/products/get` - Now uses database instead of direct API calls
- `GET /api/bills/giftcard/products/country/get/:countryCode` - Filtered by country from database
- Added pagination, search, and filtering capabilities
- **Returns complete product data** as received from Reloadly API

### 4. New Admin Endpoints
- `POST /api/sync-giftcards` - Manually trigger gift card sync
- `GET /api/giftcards/stats` - Get gift card statistics

## Key Benefits of Flexible Schema

### 🚀 **Future-Proof**
- No schema changes needed when Reloadly adds new fields
- Automatically captures all product data including new properties
- Backward compatible with existing API responses

### 📊 **Complete Data Preservation**
- Stores entire product object from Reloadly API
- No data loss during sync process
- Maintains all original field names and structure

### 🔧 **Easy Maintenance**
- Single field to manage instead of multiple specific fields
- Reduced code complexity in sync logic
- Simplified data mapping

## Setup

1. Install dependencies:
```bash
npm install node-cron
```

2. Ensure environment variables are set:
```env
RELOADLY_API_CLIENT_ID=your_client_id
RELOADLY_API_CLIENT_SECRET=your_client_secret
```

3. The cron job starts automatically when the server starts

## Usage

### Automatic Sync
The cron job runs automatically every day at 2:00 AM WAT. You can see sync logs in the server console.

### Manual Sync
To manually trigger a sync:
```bash
POST /api/sync-giftcards
```

### Get Statistics
To view gift card statistics:
```bash
GET /api/giftcards/stats
```

### Query Gift Cards
The updated endpoints now support:
- Pagination: `?page=1&size=50`
- Search: `?search=amazon`
- Country filter: `?countryCode=US`
- Brand filter: `?brandId=123`

## Data Structure

### Database Schema
```javascript
{
  productId: Number,        // Unique identifier
  data: Object,            // Complete Reloadly product data
  isActive: Boolean,       // Sync status
  lastSynced: Date,        // Last sync timestamp
  createdAt: Date,         // Document creation time
  updatedAt: Date          // Document update time
}
```

### API Response
The API returns the complete product data as stored in the `data` field, maintaining the exact structure from Reloadly API.

## Benefits

1. **Performance**: Faster response times as data is served from database
2. **Reliability**: Reduced dependency on external API availability
3. **Cost**: Fewer API calls to Reloadly
4. **Features**: Added search, pagination, and filtering capabilities
5. **Monitoring**: Better visibility into gift card data with statistics
6. **Flexibility**: Automatically adapts to API changes without code updates

## Monitoring

Check the server logs for sync status messages:
- "Starting gift card data sync..."
- "Gift card sync completed: X new, Y updated, Z errors"
- "Gift card sync cron job started - will run daily at 2:00 AM WAT"

## Error Handling

- Failed API calls are logged but don't stop the sync process
- Individual product sync failures are tracked and reported
- The system continues to work with cached data even if sync fails

## Database Maintenance

The system automatically:
- Marks old products as inactive if they haven't been synced recently
- Uses upsert operations to avoid duplicates
- Maintains indexes for optimal query performance
- Preserves complete data integrity with flexible schema 