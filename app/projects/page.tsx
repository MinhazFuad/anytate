import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Rocket } from 'lucide-react'

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
  
  // Fetch exact counts for each project efficiently
  const statsArray = projects ? await Promise.all(projects.map(async (p) => {
    // Only count images that belong to the currently selected drive folder
    const { count: total } = await supabase
      .from('images')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', p.id)
      .eq('drive_folder_id', p.drive_image_folder_id)

    const { count: done } = await supabase
      .from('images')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', p.id)
      .eq('drive_folder_id', p.drive_image_folder_id)
      .eq('status', 'done')
      
    return { id: p.id, total: total || 0, done: done || 0 }
  })) : []
  
  const statsMap = Object.fromEntries(statsArray.map(s => [s.id, s]))

  const projectStats = (projectId: string) => {
    return statsMap[projectId] || { total: 0, done: 0 }
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
          <div className="flex items-center gap-3">
            <Link 
              href="/projects/new" 
              className="h-9 flex items-center gap-2 rounded bg-accent-cyan px-4 text-sm font-display font-medium text-bg transition-colors duration-150 ease-out hover:bg-accent-cyan-hover active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring"
            >
              <Plus size={16} strokeWidth={2} /> Create Project
            </Link>
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
                     className="block rounded-lg bg-surface border border-border hover:border-accent-cyan hover:bg-surface-hover p-6 transition-colors duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring"
                   >
                     <h2 className="text-xl font-display font-medium mb-2 text-text-primary">{p.name}</h2>
                     <p className="text-sm text-text-secondary mb-6 line-clamp-2">{p.description || 'No description provided.'}</p>
                     
                     <div className="mb-6">
                       <div className="text-[11px] text-text-secondary uppercase font-display font-medium tracking-[0.03em] mb-2 flex justify-between">
                         <span>Progress</span>
                         <span className="text-text-primary font-data">{stats.done} / {stats.total}</span>
                       </div>
                       <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden border border-border">
                         <div className="h-full bg-accent-cyan transition-[width] duration-150 ease-out" style={{ width: `${stats.total > 0 ? (stats.done / stats.total) * 100 : 0}%` }}></div>
                       </div>
                     </div>

                     <div className="text-accent-cyan text-sm font-display font-medium flex items-center gap-1 group">
                       Open Dashboard 
                       <span className="transition-transform duration-150 ease-out group-hover:translate-x-1">→</span>
                     </div>
                   </a>
                 )
              })}
            </div>
          ) : (
            <div className="rounded-lg bg-surface border border-border p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
              <div className="w-20 h-20 rounded-lg bg-surface-2 border border-border flex items-center justify-center mb-6 text-accent-cyan">
                 <Rocket size={40} strokeWidth={1.5} />
              </div>
              <h2 className="text-2xl font-display font-semibold text-text-primary mb-3">Welcome to Anytate!</h2>
              <p className="text-sm text-text-secondary max-w-md mx-auto mb-8 leading-relaxed">
                You don't have any projects yet. You can wait for a team member to invite you to their project, or you can create your own workspace to start annotating immediately.
              </p>
              <Link 
                href="/projects/new" 
                className="h-11 flex items-center gap-2 rounded bg-accent-cyan px-8 text-sm font-display font-semibold text-bg transition-colors duration-150 ease-out hover:bg-accent-cyan-hover active:scale-[0.98]"
              >
                <Plus size={18} strokeWidth={2.5} /> Create Your First Project
              </Link>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
