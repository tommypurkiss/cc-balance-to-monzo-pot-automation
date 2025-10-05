# Firebase Cloud Functions

This directory contains the Firebase Cloud Functions for the CC Balance to Monzo Pot Automation project.

## 📋 Prerequisites

1. Firebase CLI installed globally:

   ```bash
   npm install -g firebase-tools
   ```

2. Firebase project initialized (you should have done this already)

3. Logged in to Firebase:
   ```bash
   firebase login
   ```

## 🏗️ Setup

If this is your first time, initialize Firebase in the project:

```bash
# From the project root
firebase init functions

# Select:
# - Use an existing project (select your Firebase project)
# - TypeScript
# - Yes to ESLint (optional)
# - Yes to install dependencies
```

**Note:** Since we've already created the functions structure, you can skip init if it asks to overwrite files.

## 🔨 Development

### Build the functions

```bash
cd functions
npm run build
```

### Watch mode (auto-rebuild on changes)

```bash
cd functions
npm run watch
```

## 🧪 Testing

### Test locally with Firebase Emulator

1. Start the emulator:

   ```bash
   cd functions
   npm run serve
   ```

2. The scheduled function won't trigger automatically in the emulator, but you can:
   - Manually trigger it via the emulator UI (usually at http://localhost:4000)
   - Or use the Firebase Functions Shell:
     ```bash
     firebase functions:shell
     # Then in the shell:
     scheduledBalanceCheck()
     ```

### Test by deploying to Firebase

```bash
# Deploy the function
firebase deploy --only functions

# Or deploy just this specific function
firebase deploy --only functions:scheduledPotTransfer
```

**Note:** After deploying, the function will run automatically at 2:00 AM UK time every day. To test immediately, you can manually trigger it from the Firebase Console:

1. Go to Firebase Console > Functions
2. Find `scheduledPotTransfer`
3. Click the three dots menu > "Execute now"

## 📊 Monitoring

### View logs in Firebase Console

1. Go to Firebase Console > Functions
2. Click on `scheduledBalanceCheck`
3. View the "Logs" tab

### View logs via CLI

```bash
firebase functions:log
```

### View execution history in Firestore

The function logs each execution to the `function_executions` collection in Firestore:

```javascript
{
  functionName: 'scheduledPotTransfer',
  executedAt: timestamp,
  scheduledTime: '2024-01-15T02:00:00Z',
  jobName: 'firebase-schedule-...',
  status: 'success' | 'error',
  message: '...',
  error: '...' // only if status is 'error'
}
```

## 🚀 Deployment

### Deploy all functions

```bash
# From project root
firebase deploy --only functions
```

### Deploy specific function

```bash
firebase deploy --only functions:scheduledPotTransfer
```

### Deploy with environment config

If you have environment variables:

```bash
firebase functions:config:set someservice.key="THE API KEY"
firebase deploy --only functions
```

## ⏰ Schedule Configuration

The current schedule is set to run every night at 2:00 AM UK time.

To modify the schedule, edit `src/scheduledPotTransfer.ts`:

```typescript
export const scheduledPotTransfer = onSchedule(
  {
    schedule: '0 2 * * *', // Cron expression
    timeZone: 'Europe/London',
    region: 'europe-west2',
  },
  async (event) => {
    // Function logic
  }
);
```

### Common Cron Patterns

- `'0 2 * * *'` - Every day at 2:00 AM
- `'0 */6 * * *'` - Every 6 hours
- `'0 9 * * 1'` - Every Monday at 9:00 AM
- `'0 0 1 * *'` - First day of every month at midnight
- `'*/30 * * * *'` - Every 30 minutes

## 🐛 Troubleshooting

### Function not deploying

- Make sure you're logged in: `firebase login`
- Check your Firebase project: `firebase use --add`
- Verify billing is enabled (Cloud Functions requires Blaze plan)

### Function not running

- Check the schedule is correct
- Verify timezone is correct
- Check Firebase Console > Functions for errors
- View logs: `firebase functions:log`

### TypeScript errors

```bash
cd functions
npm run build
```

## 📁 Project Structure

```
functions/
├── src/
│   └── scheduledPotTransfer.ts    # Scheduled pot transfer function
├── lib/                            # Compiled JavaScript (git-ignored)
├── package.json                    # Function dependencies
├── tsconfig.json                   # TypeScript configuration
└── .gitignore
```

## 🔐 Security Notes

- Firebase Admin SDK is automatically authenticated when deployed
- The function runs with admin privileges
- Ensure sensitive data is stored in environment config, not code
- Use Firebase Functions config for API keys:
  ```bash
  firebase functions:config:set truelayer.client_id="..." truelayer.client_secret="..."
  ```

## 📚 Next Steps

1. ✅ Test the function locally with the emulator
2. ✅ Deploy to Firebase and verify it runs
3. ✅ Check Firestore `function_executions` collection for logs
4. 🔄 Add the actual balance check logic (coming next!)
5. 🔄 Add user preference checking
6. 🔄 Implement the Monzo pot transfer logic
