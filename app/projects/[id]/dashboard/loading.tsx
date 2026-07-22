export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-bg p-8 font-body">
      <div className="mx-auto max-w-[1280px] space-y-8">

        {/* Header row skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="skeleton h-7 w-64 rounded" />
            <div className="skeleton h-4 w-24 rounded" />
          </div>
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-9 w-32 rounded" />
            ))}
          </div>
        </div>

        {/* Stat boxes skeleton */}
        <div className="grid grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface border border-border px-6 py-4 rounded-lg space-y-2">
              <div className="skeleton h-3 w-24 rounded" />
              <div className="skeleton h-8 w-16 rounded" />
            </div>
          ))}
        </div>

        {/* Main content area skeleton */}
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-surface border border-border rounded-lg p-6 space-y-4">
            <div className="skeleton h-5 w-40 rounded" />
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="skeleton h-4 w-4 rounded" />
                  <div className="skeleton h-4 flex-1 rounded" />
                  <div className="skeleton h-4 w-20 rounded" />
                  <div className="skeleton h-5 w-16 rounded" />
                </div>
              ))}
            </div>
          </div>
          <div className="bg-surface border border-border rounded-lg p-6 space-y-4">
            <div className="skeleton h-5 w-32 rounded" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton h-8 w-8 rounded-full" />
                  <div className="space-y-1 flex-1">
                    <div className="skeleton h-3 w-24 rounded" />
                    <div className="skeleton h-3 w-16 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
