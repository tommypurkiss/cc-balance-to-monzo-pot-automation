# Monzo OAuth Setup Guide

This guide explains how to set up Monzo OAuth for automated pot transfers.

## Why Do We Need Monzo OAuth?

You're using **TWO** different OAuth connections:

1. **TrueLayer** - Read-only access to view balances (credit cards, bank accounts, pots)
2. **Monzo OAuth** - Write access to transfer money to/from pots

## Setup Steps

### 1. Create a Monzo OAuth Client

1. Go to [Monzo Developers](https://developers.monzo.com/)
2. Sign in with your Monzo account
3. Click **"Create Client"**
4. Fill in the details:
   - **Name:** CC Balance to Pot Automation
   - **Logo:** (optional)
   - **Redirect URI:** `http://localhost:3000/api/auth/monzo/callback` (for development)
     - For production: `https://cc-balance-to-monzo.netlify.app/api/auth/monzo/callback`
     - **Note:** You can add both URLs in the Monzo dashboard for testing
   - **Description:** Automated transfers to credit card pot
   - **Confidentiality:** Confidential

5. Click **"Create Client"**
6. Copy your **Client ID** and **Client Secret**

### 2. Add Credentials to Environment Variables

Add to your `.env.local` file:

```bash
# Monzo OAuth (for pot transfers)
MONZO_CLIENT_ID=your_monzo_client_id_here
MONZO_CLIENT_SECRET=your_monzo_client_secret_here
# For development (optional - will auto-detect if not set):
MONZO_REDIRECT_URI=http://localhost:3000/api/auth/monzo/callback
# For production (optional - will auto-detect if not set):
# MONZO_REDIRECT_URI=https://cc-balance-to-monzo.netlify.app/api/auth/monzo/callback
```

### 3. Enable Automation in Dashboard

1. Run your app: `npm run dev`
2. Navigate to the dashboard
3. Connect to your Monzo account via TrueLayer (if not already connected)
4. Look for the Monzo card in your dashboard
5. Click **"Enable Automation"** button
6. Log in to Monzo and approve access in the Monzo app (PIN/fingerprint/Face ID)
7. You'll be redirected back to the dashboard

### 4. Add Environment Variables to Firebase Functions

When deploying, Firebase will prompt you for these variables:

```bash
firebase deploy --only functions
```

You'll be asked to provide:

- `ENCRYPTION_KEY`
- `TRUELAYER_CLIENT_ID`
- `TRUELAYER_CLIENT_SECRET`
- `MONZO_CLIENT_ID` ← New!
- `MONZO_CLIENT_SECRET` ← New!

Or set them manually:

```bash
firebase functions:secrets:set MONZO_CLIENT_ID
firebase functions:secrets:set MONZO_CLIENT_SECRET
```

## How It Works

### OAuth Flow

1. User clicks **"Enable Automation"** on Monzo card
2. User is redirected to Monzo authorization page
3. User logs in with email
4. User approves access in Monzo app (Strong Customer Authentication)
5. Monzo redirects back with authorization code
6. Backend exchanges code for access token + refresh token
7. Tokens are encrypted and stored in Firestore (separate from TrueLayer tokens)

### Token Storage

Tokens are stored in Firestore `user_tokens` collection:

```javascript
{
  user_id: "user123",
  provider: "monzo",  // Different from TrueLayer!
  access_token: "encrypted...",
  refresh_token: "encrypted...",
  expires_at: 1234567890,
  monzo_user_id: "user_monzo_id",
  // ...
}
```

### Scheduled Function

Every night at 2 AM:

1. Checks credit card balances via **TrueLayer** (read-only)
2. Checks Monzo account & pot balances via **TrueLayer** (read-only)
3. Calculates transfer amount needed
4. Gets **Monzo OAuth token** from Firestore
5. Uses **Monzo API** to transfer money (write access)

## Token Expiry

- **Access Token:** Expires after 6 hours (21600 seconds)
- **Refresh Token:** Long-lived, used to get new access tokens
- The function automatically refreshes expired tokens

## Testing

1. Enable automation in dashboard
2. Wait until 2 AM, or manually trigger the function:
   ```bash
   firebase functions:log
   ```
3. Check logs to see the transfer execution

## Troubleshooting

### "No Monzo OAuth token found"

- User hasn't clicked "Enable Automation" yet
- Check Firestore `user_tokens` collection for `provider: "monzo"`

### "Failed to transfer to pot"

- Token may be expired (should auto-refresh)
- Insufficient funds in main account
- Check Firebase Functions logs: `firebase functions:log`

### "Monzo credentials not configured"

- Missing environment variables in `.env.local` or Firebase Functions
- Double-check `MONZO_CLIENT_ID` and `MONZO_CLIENT_SECRET`

## Security Notes

- ✅ Tokens are encrypted before storing in Firestore
- ✅ Only you can access your own account (Monzo OAuth restriction)
- ✅ Strong Customer Authentication required (PIN/fingerprint/Face ID)
- ✅ Access tokens expire after 6 hours
- ✅ Refresh tokens rotate on each refresh

## Important: Monzo API Limitations

⚠️ **The Monzo Developer API is not suitable for building public applications.**

You may only:

- Connect to your own account
- Connect to accounts of a small set of users you explicitly allow

This is perfect for personal automation! 🎉
