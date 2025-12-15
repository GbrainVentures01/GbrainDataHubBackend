# Analytics Dashboard Integration Guide

## Backend Changes

### New Endpoints Added:

1. **GET /api/analytics/chart-data**
   - Returns time-series data for charts
   - Supports filters: `today`, `this_week`, `this_month`, `custom`
   - Query Parameters:
     - `filter`: Filter type (default: `this_month`)
     - `dateFrom`: Start date for custom filter (ISO format)
     - `dateTo`: End date for custom filter (ISO format)
   - Response includes:
     - `timeSeries`: Array of daily data with transactions, revenue, successful, failed counts
     - `serviceBreakdown`: Array of service-wise transaction counts and revenue

2. **Enhanced GET /api/analytics/dashboard**
   - Now includes `chartData` in the response
   - Contains daily aggregated data for quick visualization

### Usage Examples:

```bash
# Get data for today
GET /api/analytics/chart-data?filter=today

# Get data for this week
GET /api/analytics/chart-data?filter=this_week

# Get data for this month (default)
GET /api/analytics/chart-data?filter=this_month

# Get custom date range
GET /api/analytics/chart-data?filter=custom&dateFrom=2025-01-01&dateTo=2025-01-31
```

### Response Format:

```json
{
  "success": true,
  "filter": "this_month",
  "dateRange": {
    "from": "2025-12-01T00:00:00.000Z",
    "to": "2025-12-15T23:59:59.999Z"
  },
  "data": {
    "timeSeries": [
      {
        "date": "2025-12-01",
        "transactions": 150,
        "revenue": 45000.50,
        "successful": 145,
        "failed": 5
      }
    ],
    "serviceBreakdown": [
      {
        "service": "airtime",
        "count": 500,
        "revenue": 125000.00
      },
      {
        "service": "data",
        "count": 800,
        "revenue": 320000.00
      }
    ]
  }
}
```

## Frontend Integration

### Prerequisites:

Install required dependencies:
```bash
npm install recharts
# or
yarn add recharts
```

### Integration Steps:

1. **Copy the Component**
   - Copy `frontend-example/AnalyticsDashboard.jsx` to your gbrain-admin project
   - Place it in your components or pages directory

2. **Configure API URL**
   - Set `REACT_APP_API_URL` in your `.env` file:
   ```env
   REACT_APP_API_URL=http://localhost:1337/api
   ```

3. **Add to Your Routes**
   ```jsx
   import AnalyticsDashboard from './components/AnalyticsDashboard';
   
   // In your router
   <Route path="/analytics" element={<AnalyticsDashboard />} />
   ```

### Features:

✅ **Filter Options:**
- Today
- This Week
- This Month
- Custom Date Range

✅ **Visualizations:**
- Revenue Trend (Line Chart)
- Transaction Volume (Bar Chart)
- Service Distribution (Pie Chart)
- Revenue by Service (Bar Chart)

✅ **Stats Cards:**
- Total Transactions
- Total Revenue
- Success Rate
- Total Users

✅ **Recent Transactions Table**
- Service type
- User
- Beneficiary
- Amount
- Status
- Date

### Customization:

**Change Colors:**
```javascript
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];
```

**Adjust Chart Height:**
```jsx
<ResponsiveContainer width="100%" height={300}>
```

**Modify Date Format:**
```javascript
const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};
```

### Styling:

The component uses Tailwind CSS. If you're using a different CSS framework:

1. Replace Tailwind classes with your framework's classes
2. Or add Tailwind to your project:
   ```bash
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   ```

## Testing:

1. **Start Backend:**
   ```bash
   npm run develop
   ```

2. **Test Endpoints:**
   ```bash
   # Test dashboard endpoint
   curl http://localhost:1337/api/analytics/dashboard
   
   # Test chart data endpoint
   curl http://localhost:1337/api/analytics/chart-data?filter=this_month
   ```

3. **Start Frontend:**
   ```bash
   npm start
   ```

4. **Visit:**
   ```
   http://localhost:3000/analytics
   ```

## Notes:

- Charts automatically refresh when filter changes
- Custom date range requires both start and end dates
- All amounts are formatted in Nigerian Naira (NGN)
- Times are displayed in local timezone
- Error handling is built-in with loading states
