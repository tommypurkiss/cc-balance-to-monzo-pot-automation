interface AddMoreAccountsProps {
  currentUserId?: string;
}

export default function AddMoreAccounts({
  currentUserId,
}: AddMoreAccountsProps) {
  return (
    <div className="border border-blue-600 bg-gray-800 p-6 rounded-lg text-center">
      <h2 className="text-xl font-semibold mb-3 text-blue-400">
        Step 2: Add More Accounts
      </h2>
      <p className="text-gray-300 mb-4">
        Connect your credit cards and other bank accounts to track spending and
        enable automation.
      </p>
      <button
        onClick={() => {
          const userId = currentUserId || 'anonymous';
          window.location.href = `/api/auth/truelayer?userId=${userId}`;
        }}
        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
      >
        Add Credit Cards & Other Banks
      </button>
    </div>
  );
}
