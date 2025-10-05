# Banking Data Context

## Overview

The `BankingDataContext` provides a centralized state management solution for banking data (accounts, cards, and balances) fetched from TrueLayer. This context prevents unnecessary API calls by caching data at the application level.

## Benefits

1. **Reduced API Calls**: Data is fetched only once per user session, not on every page visit
2. **Improved Performance**: Faster page loads when navigating to/from the dashboard
3. **Centralized State**: Banking data is accessible from any component in the app
4. **Consistent UX**: Loading states are managed at the context level

## Architecture

```
AppProviders
  └─ AuthProvider (provides currentUser)
      └─ UserProvider (provides userProfile)
          └─ BankingDataProvider (provides banking data)
              └─ App Components
```

## Usage

### Hook

```typescript
import { useBankingData } from '@/contexts/BankingDataContext';

function MyComponent() {
  const { data, loading, error, loadData, removeProvider } = useBankingData();

  // Access banking data
  const providers = Object.keys(data);

  // Force refresh
  const handleRefresh = () => {
    loadData(true); // true = force refresh
  };

  // Remove a provider
  const handleDisconnect = (provider: string) => {
    removeProvider(provider);
  };
}
```

### Context API

- `data`: Object containing all provider data (accounts & cards with balances)
- `loading`: Boolean indicating if data is being fetched
- `error`: String with error message, or null
- `loadData(forceRefresh?: boolean)`: Function to load or refresh data
- `removeProvider(provider: string)`: Function to remove a provider from state
- `isInitialized`: Boolean indicating if initial load has completed

## Data Structure

```typescript
interface BankingData {
  [provider: string]: {
    cards: Array<CardData & { balance?: CardBalance }>;
    accounts: Array<AccountData & { balance?: AccountBalance }>;
  };
}
```

## Loading Strategy

1. **Initial Load**: When a user logs in, data is fetched automatically
2. **In-Memory Cache**: Data is stored in React state (memory only)
3. **Navigation**: No API calls when navigating between pages in the app
4. **Page Refresh**: Fresh API call on browser refresh (for security)
5. **Manual Refresh**: Users can click "Refresh Data" to force an update
6. **Automatic Cleanup**: Data is cleared when user logs out

## Implementation Details

- The context initializes automatically when `currentUser` is available
- Uses `isInitialized` flag to prevent redundant fetches
- Data stored in React state (memory only) for security
- Does NOT use browser storage (sessionStorage/localStorage) to avoid exposing sensitive banking data
- Integrates with existing `clientStorage` for token management
- Handles authentication errors gracefully
- Clears data on logout

## Security Considerations

**Why no browser storage?**

- Banking data (balances, account numbers) is sensitive
- Browser storage (sessionStorage/localStorage) is vulnerable to XSS attacks
- Malicious browser extensions could access stored data
- Trade-off: Security over convenience (requires API call on page refresh)

**What's still cached:**

- Data persists in memory while navigating within the app
- Only lost on page refresh or tab close

## Migration from Component State

The `TrueLayerDashboard` component was migrated from managing its own state to using the context:

**Before:**

```typescript
const [data, setData] = useState({});
useEffect(() => {
  loadData(); // Fetches on every mount AND every page refresh
}, [currentUser]);
```

**After:**

```typescript
const { data, loading, error } = useBankingData();
// Data is fetched once per session, cached in memory (not browser storage for security)
```

## Performance Impact

- **Before**: API calls on every component mount (every navigation to dashboard)
- **After**: API calls only once per React session
- **Navigation**: No API calls when moving between pages
- **Page Refresh**: Fresh API call (by design, for security)

## Testing

The context is automatically included in the `AppProviders` wrapper, so existing tests continue to work without modification.
