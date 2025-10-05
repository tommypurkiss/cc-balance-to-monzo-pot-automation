# Netlify Deployment Guide

## Prerequisites

1. Your app is successfully building locally (`npm run build`)
2. You have a Netlify account
3. Your repository is connected to Netlify

## Step 1: Get Your Netlify Site URL

1. Go to your Netlify dashboard
2. Find your site and note the URL (e.g., `https://your-site-name.netlify.app`)
3. If you want a custom domain, set that up first

## Step 2: Update Environment Variables in Netlify

In your Netlify dashboard, go to **Site settings > Environment variables** and add/update:

```env
# TrueLayer API
TRUELAYER_CLIENT_ID=your_truelayer_client_id
TRUELAYER_CLIENT_SECRET=your_truelayer_client_secret
# Optional: The app will auto-detect the correct URL, but you can override:
TRUELAYER_REDIRECT_URI=https://cc-balance-to-monzo.netlify.app/api/auth/truelayer/callback

# Monzo API
MONZO_CLIENT_ID=your_monzo_client_id
MONZO_CLIENT_SECRET=your_monzo_client_secret
# Optional: The app will auto-detect the correct URL, but you can override:
MONZO_REDIRECT_URI=https://cc-balance-to-monzo.netlify.app/api/auth/monzo/callback

# Firebase (Client-side)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id

# Firebase (Server-side)
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_PRIVATE_KEY=your_firebase_private_key

# Encryption
ENCRYPTION_KEY=your_encryption_key

# Netlify Site URL (for internal use)
NETLIFY_SITE_URL=https://cc-balance-to-monzo.netlify.app
```

## Step 3: Update External Service Configurations

### TrueLayer Dashboard

1. Go to [TrueLayer Developer Dashboard](https://console.truelayer.com/)
2. Navigate to your app settings
3. Update the **Redirect URI** from:
   - `http://localhost:3000/api/auth/truelayer/callback`
   - To: `https://cc-balance-to-monzo.netlify.app/api/auth/truelayer/callback`

### Monzo Developer Dashboard

1. Go to [Monzo Developer Dashboard](https://developers.monzo.com/)
2. Navigate to your app settings
3. Update the **Redirect URI** from:
   - `http://localhost:3000/api/auth/monzo/callback`
   - To: `https://cc-balance-to-monzo.netlify.app/api/auth/monzo/callback`

## Step 4: Deploy

1. Push your changes to your repository
2. Netlify will automatically trigger a new build
3. Monitor the build logs for any issues

## Step 5: Test the Deployment

1. Visit your Netlify site URL
2. Test the authentication flow:
   - Sign up/Sign in
   - Connect TrueLayer accounts
   - Connect Monzo account
   - Test the automation features

## Troubleshooting

### Common Issues

1. **OAuth redirect errors**: Make sure the redirect URIs in both Netlify environment variables and external service dashboards match exactly
2. **Build failures**: Check that all environment variables are set correctly
3. **Firebase errors**: Ensure Firebase is configured for your production domain

### Environment Variable Checklist

- [ ] `TRUELAYER_REDIRECT_URI` points to your Netlify URL (optional - auto-detected)
- [ ] `MONZO_REDIRECT_URI` points to your Netlify URL (optional - auto-detected)
- [ ] `NETLIFY_SITE_URL` is set to your Netlify URL (for auto-detection)
- [ ] All Firebase variables are set
- [ ] `ENCRYPTION_KEY` is set

### External Service Checklist

- [ ] TrueLayer redirect URI updated
- [ ] Monzo redirect URI updated
- [ ] Both services are in production mode (not sandbox)

## Security Notes

1. Never commit environment variables to your repository
2. Use Netlify's environment variable system for all secrets
3. Ensure your Firebase project allows your Netlify domain
4. Consider setting up a custom domain for better security

## Next Steps

After successful deployment:

1. Set up monitoring and logging
2. Configure automated backups
3. Set up SSL certificate (usually automatic with Netlify)
4. Consider setting up a staging environment for testing
