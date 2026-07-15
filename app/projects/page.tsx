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
    <div className="min-h-screen bg-black/50 p-8 text-white relative">
      <div className="mx-auto max-w-5xl relative z-10">
        <header className="mb-8 flex items-center justify-between glass px-8 py-4 rounded-2xl">
          <div>
            <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-accent to-purple-400">Projects</h1>
            <p className="mt-1 text-sm text-muted">
              Logged in as <span className="text-white/80 font-medium">{user.email}</span>
            </p>
          </div>
          <form action="/auth/signout" method="post">
            <button
              className="rounded-lg border border-white/10 px-5 py-2 text-sm font-semibold transition-all hover:bg-white/10 hover:border-white/20 hover:text-white"
              type="submit"
            >
              Sign out
            </button>
          </form>
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
                     className="block rounded-2xl glass glass-interactive p-6"
                   >
                     <h2 className="text-xl font-bold mb-2">{p.name}</h2>
                     <p className="text-sm text-muted mb-6 line-clamp-2">{p.description || 'No description provided.'}</p>
                     
                     <div className="mb-6">
                       <div className="text-xs text-muted font-mono mb-2 flex justify-between">
                         <span>Progress</span>
                         <span className="text-white">{stats.done} / {stats.total}</span>
                       </div>
                       <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden border border-white/5">
                         <div className="h-full bg-gradient-to-r from-accent to-purple-500 shadow-[0_0_10px_rgba(56,189,248,0.8)]" style={{ width: `${stats.total > 0 ? (stats.done / stats.total) * 100 : 0}%` }}></div>
                       </div>
                     </div>

                     <div className="text-accent text-sm font-bold flex items-center gap-1 group">
                       Open Dashboard 
                       <span className="transition-transform group-hover:translate-x-1">→</span>
                     </div>
                   </a>
                 )
              })}
            </div>
          ) : (
            <div className="rounded-2xl glass p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                 <span className="text-2xl opacity-50">📁</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">No projects found</h2>
              <p className="text-sm text-muted max-w-md">
                You do not have access to any projects yet. When you are added to a project, it will appear here.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
