interface SetupProgressProps {
  step1Complete: boolean;
  step2Complete: boolean;
  step3Complete: boolean;
}

export default function SetupProgress({
  step1Complete,
  step2Complete,
  step3Complete,
}: SetupProgressProps) {
  return (
    <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
        <span className="mr-2">🎯</span>
        Setup Progress
      </h2>
      <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-4">
        {/* Step 1 */}
        <div
          className={`flex items-center p-3 rounded-lg border ${
            step1Complete
              ? 'bg-green-600/20 border-green-500/30'
              : 'bg-gray-700/50 border-gray-600'
          }`}
        >
          <div
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
              step1Complete ? 'bg-green-600' : 'bg-gray-600'
            }`}
          >
            {step1Complete ? (
              <svg
                className="w-5 h-5 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <span className="text-white font-bold text-sm">1</span>
            )}
          </div>
          <div>
            <h3
              className={`font-medium text-sm ${step1Complete ? 'text-green-300' : 'text-gray-300'}`}
            >
              Monzo Connected
            </h3>
            <p className="text-xs text-gray-400">Direct Monzo account</p>
          </div>
        </div>

        {/* Step 2 */}
        <div
          className={`flex items-center p-3 rounded-lg border ${
            step2Complete
              ? 'bg-green-600/20 border-green-500/30'
              : step1Complete
                ? 'bg-blue-600/20 border-blue-500/30'
                : 'bg-gray-700/50 border-gray-600'
          }`}
        >
          <div
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
              step2Complete
                ? 'bg-green-600'
                : step1Complete
                  ? 'bg-blue-600'
                  : 'bg-gray-600'
            }`}
          >
            {step2Complete ? (
              <svg
                className="w-5 h-5 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <span className="text-white font-bold text-sm">2</span>
            )}
          </div>
          <div>
            <h3
              className={`font-medium text-sm ${
                step2Complete
                  ? 'text-green-300'
                  : step1Complete
                    ? 'text-blue-300'
                    : 'text-gray-300'
              }`}
            >
              Cards & Accounts
            </h3>
            <p className="text-xs text-gray-400">Credit cards & other banks</p>
          </div>
        </div>

        {/* Step 3 */}
        <div
          className={`flex items-center p-3 rounded-lg border ${
            step3Complete
              ? 'bg-green-600/20 border-green-500/30'
              : step2Complete
                ? 'bg-blue-600/20 border-blue-500/30'
                : 'bg-gray-700/50 border-gray-600'
          }`}
        >
          <div
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
              step3Complete
                ? 'bg-green-600'
                : step2Complete
                  ? 'bg-blue-600'
                  : 'bg-gray-600'
            }`}
          >
            {step3Complete ? (
              <svg
                className="w-5 h-5 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <span className="text-white font-bold text-sm">3</span>
            )}
          </div>
          <div>
            <h3
              className={`font-medium text-sm ${
                step3Complete
                  ? 'text-green-300'
                  : step2Complete
                    ? 'text-blue-300'
                    : 'text-gray-300'
              }`}
            >
              Automation Rules
            </h3>
            <p className="text-xs text-gray-400">Set up pot transfers</p>
          </div>
        </div>
      </div>
    </div>
  );
}
