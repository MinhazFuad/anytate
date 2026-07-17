'use client'
 
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="p-8 text-text-primary bg-bg min-h-screen">
      <h2 className="text-xl font-bold mb-4">Something went wrong in the Dashboard!</h2>
      <pre className="bg-surface border border-border p-4 rounded-md text-sm text-accent-red mb-4 whitespace-pre-wrap">
        {error.message}
        {'\n'}
        {error.stack}
      </pre>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-accent-cyan text-bg rounded-md"
      >
        Try again
      </button>
    </div>
  )
}
