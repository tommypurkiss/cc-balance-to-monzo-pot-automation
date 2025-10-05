# 🔥 Firebase Functions Setup & Deployment Guide

## ✅ What's Been Created

I've set up a Firebase Cloud Function that will run every night at **2:00 AM UK time**. Here's what was created:

```
functions/
├── src/
│   └── scheduledPotTransfer.ts    # Your scheduled function
├── package.json              # Function dependencies
├── tsconfig.json             # TypeScript config
├── .gitignore                # Ignore compiled files
└── README.md                 # Detailed documentation

firebase.json                 # Firebase project config (root)
```

## 🎯 What the Function Does Right Now

The `scheduledPotTransfer` function currently:

- ✅ Runs every day at 2:00 AM UK time
- ✅ Logs the execution to the console
- ✅ Records each run in Firestore (`function_executions` collection)
- ✅ Handles errors gracefully

This is perfect for testing that the scheduling infrastructure works!

## 🚀 Quick Start - Deploy & Test

### Step 1: Install Firebase CLI (if not already installed)

```bash
npm install -g firebase-tools
```

### Step 2: Login to Firebase

```bash
firebase login
```

### Step 3: Initialize Firebase (if not already done)

```bash
firebase use --add
# Select your Firebase project from the list
```

### Step 4: Build the Function

```bash
# From project root
npm run functions:build

# Or
cd functions && npm run build
```

### Step 5: Deploy to Firebase

```bash
# From project root
npm run functions:deploy

# Or
firebase deploy --only functions
```

**Note:** You need to be on the **Blaze (pay-as-you-go) plan** for Cloud Functions. The free Spark plan doesn't support them.

### Step 6: Test the Deployment

#### Option A: Wait for 2:00 AM 😴

Just wait until tomorrow at 2 AM and check the logs!

#### Option B: Manually Trigger (Recommended for Testing)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Navigate to your project
3. Go to **Functions** in the left sidebar
4. Find `scheduledPotTransfer` in the list
5. Click the **⋮** (three dots) menu
6. Select **"Execute now"** or **"Test function"**

#### Option C: Use Firebase Emulator (Local Testing)

```bash
# Terminal 1 - Start the emulator
npm run functions:serve

# Terminal 2 - Trigger the function
firebase functions:shell
# Then in the shell:
> scheduledPotTransfer()
```

### Step 7: Check the Results

#### View Logs in Console

```bash
npm run functions:logs
```

#### Check Firestore

1. Go to Firebase Console > Firestore Database
2. Look for the `function_executions` collection
3. You should see a document like:
   ```json
   {
     "functionName": "scheduledPotTransfer",
     "executedAt": "2024-10-05T02:00:00Z",
     "scheduledTime": "2024-10-05T02:00:00Z",
     "status": "success",
     "message": "Test execution completed successfully"
   }
   ```

## 🔧 Configuration

### Current Schedule

- **Frequency:** Daily
- **Time:** 2:00 AM
- **Timezone:** Europe/London
- **Region:** europe-west2 (London)

### To Change the Schedule

Edit `functions/src/scheduledPotTransfer.ts`:

```typescript
export const scheduledPotTransfer = onSchedule(
  {
    schedule: '0 2 * * *', // Change this cron expression
    timeZone: 'Europe/London',
    region: 'europe-west2',
  },
  async (event) => {
    // Function logic
  }
);
```

**Useful Cron Expressions:**

- `'*/15 * * * *'` - Every 15 minutes (for testing)
- `'0 */6 * * *'` - Every 6 hours
- `'0 9 * * *'` - Every day at 9 AM
- `'0 9 * * 1'` - Every Monday at 9 AM
- `'0 0 1 * *'` - First day of each month

## 📊 Monitoring

### View Recent Logs

```bash
npm run functions:logs
```

### View in Firebase Console

1. Go to Functions
2. Click on `scheduledPotTransfer`
3. Click the **Logs** tab

### Check Execution History

Query the `function_executions` collection in Firestore to see all past runs.

## 💡 Helpful Commands

From the project root, you can now use:

```bash
npm run functions:build    # Build TypeScript to JavaScript
npm run functions:watch    # Auto-rebuild on changes
npm run functions:serve    # Run local emulator
npm run functions:deploy   # Deploy to Firebase
npm run functions:logs     # View logs
```

## 🐛 Troubleshooting

### "Permission denied" or "Billing required"

- Cloud Functions require the **Blaze plan** (pay-as-you-go)
- Upgrade in Firebase Console > Settings > Usage and billing

### "Function not found" after deployment

- Wait 1-2 minutes for deployment to complete
- Check deployment status: `firebase deploy --only functions`
- Verify in Firebase Console > Functions

### Function not running at scheduled time

- Check timezone is correct
- Verify cron expression is valid
- Check Firebase Console > Functions > Logs for errors
- Make sure the function deployed successfully

### Build errors

```bash
cd functions
npm install
npm run build
```

## 🎉 Next Steps

Once you've verified the function runs successfully at 2 AM:

1. ✅ Check logs in Firebase Console
2. ✅ Verify documents appear in Firestore `function_executions` collection
3. 🔄 Add the actual balance checking logic
4. 🔄 Implement user preferences
5. 🔄 Add Monzo pot transfer functionality

## 📚 More Info

See `functions/README.md` for detailed documentation.

---

**Testing Tip:** To test immediately without waiting for 2 AM, temporarily change the schedule to run every 5 minutes:

```typescript
schedule: '*/5 * * * *',  // Every 5 minutes
```

Then redeploy and check logs after 5 minutes!
