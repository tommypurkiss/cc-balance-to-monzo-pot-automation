interface LoadingSpinnerProps {
  loadingMessage: string;
}

export default function LoadingSpinner({
  loadingMessage,
}: LoadingSpinnerProps) {
  return (
    <div className="border border-blue-600 bg-gray-800 p-6 rounded-lg">
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
        <span className="ml-3 text-gray-300">{loadingMessage}</span>
      </div>
    </div>
  );
}
