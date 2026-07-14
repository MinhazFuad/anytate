import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function ProjectsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-background p-8 text-text">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Projects</h1>
            <p className="mt-1 text-sm text-muted">
              Logged in as {user.email}
            </p>
          </div>
          <form action="/auth/signout" method="post">
            <button
              className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/5"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </header>

        <main>
          <div className="rounded-xl border border-white/10 bg-surface p-8 text-center shadow-lg">
            <h2 className="text-xl font-semibold text-muted">No projects yet</h2>
            <p className="mt-2 text-sm text-muted">
              Project creation will be implemented in Milestone 2.
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
