export default function ProjectsLoading() {
  return (
    <div className="min-h-screen bg-bg p-8 text-text-primary font-body">
      <div className="mx-auto max-w-[1280px]">
        {/* Header skeleton */}
        <div className="mb-8 flex items-center justify-between bg-surface border border-border px-8 py-4 rounded-lg">
          <div className="space-y-2">
            <div className="skeleton h-6 w-28 rounded" />
            <div className="skeleton h-4 w-48 rounded" />
          </div>
          <div className="skeleton h-9 w-36 rounded" />
        </div>

        {/* Project cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-surface border border-border p-6 rounded-lg space-y-4">
              <div className="skeleton h-6 w-3/4 rounded" />
              <div className="space-y-2">
                <div className="skeleton h-4 w-full rounded" />
                <div className="skeleton h-4 w-2/3 rounded" />
              </div>
              <div className="space-y-2 pt-2">
                <div className="flex justify-between">
                  <div className="skeleton h-3 w-16 rounded" />
                  <div className="skeleton h-3 w-12 rounded" />
                </div>
                <div className="skeleton h-1.5 w-full rounded-full" />
              </div>
              <div className="skeleton h-4 w-32 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
