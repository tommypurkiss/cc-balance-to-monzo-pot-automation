# CC Balance to Monzo Pot Automation

An automated system that monitors your credit card balances via TrueLayer API and transfers money from your Monzo account to your credit card pot when balances exceed the current pot amount.

## 🎯 How It Works

1. **Daily Monitoring**: A Firebase scheduled function runs every day at 2:00 AM
2. **Balance Check**: Fetches your credit card balances from TrueLayer API
3. **Pot Comparison**: Compares total CC balance with current Monzo pot balance
4. **Smart Transfer**: If CC balance > pot balance, automatically transfers the difference from your Monzo account to the credit card pot
5. **Transaction Logging**: Records all activities in Firestore for audit and monitoring

## 🏗️ Architecture

### Frontend (Next.js + Netlify)

- **Dashboard**: Simple web interface for monitoring transactions and manual controls
- **Authentication**: Optional Firebase Auth for personal access
- **Configuration**: Manage settings and view transaction history

### Backend (Firebase Functions)

- **Scheduled Automation**: Daily balance checking and transfer execution
- **API Integration**: Secure connections to TrueLayer and Monzo APIs
- **Data Storage**: Firestore for transaction logs and configuration

### Security

- **Encrypted Storage**: All tokens and sensitive data encrypted in Firestore
- **Environment Variables**: API keys stored securely in Netlify environment
- **Minimal Data**: Only essential transaction data is stored

## 🔧 Tech Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Backend**: Firebase Functions, Firestore
- **APIs**: TrueLayer (banking), Monzo (transfers)
- **Hosting**: Netlify (frontend), Firebase (functions)
- **Authentication**: Firebase Auth (optional)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Firebase project
- TrueLayer developer account
- Monzo developer account
- Netlify account

### Installation

1. **Clone and install dependencies**:

   ```bash
   git clone <repository-url>
   cd cc-balance-to-monzo-pot-automation
   npm install
   ```

2. **Set up environment variables**:

   ```bash
   cp .env.example .env.local
   # Fill in your API credentials
   ```

3. **Configure Firebase**:

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init
   ```

4. **Run development server**:
   ```bash
   npm run dev
   ```

### Environment Variables

Create a `.env.local` file with the following variables:

```env
# TrueLayer API
TRUELAYER_CLIENT_ID=your_truelayer_client_id
TRUELAYER_CLIENT_SECRET=your_truelayer_client_secret
# For development (optional - will auto-detect if not set):
# TRUELAYER_REDIRECT_URI=http://localhost:3000/api/auth/truelayer/callback
# For production (optional - will auto-detect if not set):
# TRUELAYER_REDIRECT_URI=https://your-site.netlify.app/api/auth/truelayer/callback

# Monzo API
MONZO_CLIENT_ID=your_monzo_client_id
MONZO_CLIENT_SECRET=your_monzo_client_secret
# For development (optional - will auto-detect if not set):
# MONZO_REDIRECT_URI=http://localhost:3000/api/auth/monzo/callback
# For production (optional - will auto-detect if not set):
# MONZO_REDIRECT_URI=https://your-site.netlify.app/api/auth/monzo/callback

# Firebase (Client-side - for authentication)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id

# Firebase (Server-side - for admin SDK)
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email

# App Configuration
ENCRYPTION_KEY=your_32_character_encryption_key
```

### Firebase Setup

1. **Get Firebase Configuration**:
   - Go to your Firebase project settings
   - Scroll down to "Your apps" section
   - Click on the web app icon (</>) to add a web app
   - Copy the configuration values to your `.env.local` file

2. **Enable Authentication**:
   - In Firebase Console, go to Authentication > Sign-in method
   - Enable "Email/Password" provider
   - Optionally enable other providers as needed

3. **Set up Firestore**:
   - Go to Firestore Database in Firebase Console
   - Create database in production mode
   - Set up security rules (start with test mode for development)

## 📋 Features

- ✅ **Automated Daily Checks**: Runs every day at 2:00 AM
- ✅ **Smart Balance Calculation**: Compares total CC balance with pot balance
- ✅ **Secure API Integration**: Encrypted token storage and automatic refresh
- ✅ **Transaction Logging**: Complete audit trail of all activities
- ✅ **Manual Override**: Dashboard for manual triggers and monitoring
- ✅ **Error Handling**: Robust retry mechanisms and error reporting

## 🔒 Security

- All sensitive data encrypted at rest in Firestore
- API tokens automatically refreshed
- Environment variables for secure credential storage
- Minimal data retention policy
- Personal use only - no shared access

## 📊 Monitoring

- Transaction history dashboard
- Error logging and alerts
- Balance change notifications
- Function execution monitoring
- Manual trigger capability

## 🚀 Deployment

### Netlify (Frontend)

1. Connect your GitHub repository to Netlify
2. Set environment variables in Netlify dashboard
3. Deploy automatically on push to main branch

### Firebase Functions (Backend)

1. Deploy functions: `firebase deploy --only functions`
2. Configure scheduled triggers
3. Set up monitoring and alerts

## 📁 Project Structure

```
├── src/
│   ├── app/                 # Next.js app router
│   │   ├── api/            # API routes for auth and webhooks
│   │   ├── dashboard/      # Monitoring dashboard
│   │   └── components/     # Reusable UI components
│   ├── lib/                # Utility libraries
│   │   ├── truelayer.ts    # TrueLayer API integration
│   │   ├── monzo.ts        # Monzo API integration
│   │   ├── firebase.ts     # Firebase configuration
│   │   └── encryption.ts   # Data encryption utilities
│   └── types/              # TypeScript type definitions
├── functions/              # Firebase Functions
│   ├── src/
│   │   ├── index.ts        # Function entry points
│   │   ├── scheduled/      # Scheduled automation logic
│   │   └── utils/          # Shared utilities
└── docs/                   # Documentation
```

## 🤝 Contributing

This is a personal automation project. If you find it useful and want to adapt it for your own use:

1. Fork the repository
2. Set up your own API credentials
3. Modify the configuration for your specific needs
4. Deploy to your own Netlify and Firebase accounts

## ⚠️ Disclaimer

This tool automates financial transactions. Use at your own risk and ensure you understand the implications of automated money transfers. Always test thoroughly in a safe environment before using with real money.

## 📄 License

MIT License - see LICENSE file for details.
