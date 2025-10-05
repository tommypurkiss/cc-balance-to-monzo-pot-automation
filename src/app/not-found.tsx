import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-white mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-300 mb-6">
          Page Not Found
        </h2>
        <p className="text-gray-400 mb-8">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/"
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
