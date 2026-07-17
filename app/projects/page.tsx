import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'
import { Plus } from 'lucide-react'

export default async function ProjectsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch projects the user has access to
  const { data: projects } = await supabase.from('projects').select('*')
  
  // Fetch basic stats so the user knows which project they are working on
  const { data: images } = await supabase.from('images').select('project_id, status')
  
  const projectStats = (projectId: string) => {
    if (!images) return { total: 0, done: 0 }
    const projectImages = images.filter(i => i.project_id === projectId)
    return {
      total: projectImages.length,
      done: projectImages.filter(i => i.status === 'done').length
    }
  }

  return (
    <div className="min-h-screen bg-bg p-8 text-text-primary font-body">
      <div className="mx-auto max-w-[1280px]">
        <header className="mb-8 flex items-center justify-between bg-surface border border-border px-8 py-4 rounded-lg">
          <div>
            <h1 className="text-2xl font-display font-semibold text-text-primary">Projects</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Logged in as <span className="text-text-primary font-medium">{user.email}</span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link 
              href="/projects/new" 
              className="flex items-center gap-2 rounded-md bg-accent-cyan px-5 py-2 text-sm font-display font-medium text-bg transition-colors hover:bg-accent-cyan-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring"
            >
              <Plus size={16} strokeWidth={2} /> Create Project
            </Link>
            <ThemeToggle />
            <form action="/auth/signout" method="post">
              <button
                className="rounded-md border border-border px-5 py-2 text-sm font-display font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:border-accent-cyan hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring"
                type="submit"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>

        <main>
          {projects && projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((p) => {
                 const stats = projectStats(p.id)
                 return (
                   <a 
                     key={p.id} 
                     href={`/projects/${p.id}/dashboard`}
                     className="block rounded-lg bg-surface border border-border hover:border-accent-cyan hover:bg-surface-hover p-6 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring"
                   >
                     <h2 className="text-xl font-display font-medium mb-2 text-text-primary">{p.name}</h2>
                     <p className="text-sm text-text-secondary mb-6 line-clamp-2">{p.description || 'No description provided.'}</p>
                     
                     <div className="mb-6">
                       <div className="text-[11px] text-text-secondary uppercase font-display font-medium tracking-[0.03em] mb-2 flex justify-between">
                         <span>Progress</span>
                         <span className="text-text-primary font-data">{stats.done} / {stats.total}</span>
                       </div>
                       <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden border border-border">
                         <div className="h-full bg-accent-cyan transition-all duration-1000 ease-out" style={{ width: `${stats.total > 0 ? (stats.done / stats.total) * 100 : 0}%` }}></div>
                       </div>
                     </div>

                     <div className="text-accent-cyan text-sm font-display font-medium flex items-center gap-1 group">
                       Open Dashboard 
                       <span className="transition-transform group-hover:translate-x-1">→</span>
                     </div>
                   </a>
                 )
              })}
            </div>
          ) : (
            <div className="rounded-lg bg-surface border border-border p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
              <div className="w-16 h-16 rounded-full bg-surface-2 border border-border flex items-center justify-center mb-4">
                 <span className="text-2xl opacity-50">📁</span>
              </div>
              <h2 className="text-xl font-display font-medium text-text-primary mb-2">No projects found</h2>
              <p className="text-sm text-text-secondary max-w-md mx-auto">
                You do not have access to any projects yet. When you are added to a project, it will appear here.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
