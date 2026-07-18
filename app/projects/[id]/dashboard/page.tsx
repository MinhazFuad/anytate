'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'
import { toast } from 'sonner'
import { ArrowLeft, Clock, Layout, CheckSquare, Settings, Network, ImageIcon } from 'lucide-react'
import ProjectSettingsModal from '@/components/ProjectSettingsModal'

export default function ProjectDashboardPage() {
  const { id } = useParams()
  const supabase = createClient()
  
  const [showSettings, setShowSettings] = useState(false)
  const [loadingStep, setLoadingStep] = useState<string>('Initializing...')
  const [project, setProject] = useState<any>(null)
  const [role, setRole] = useState<string>('annotator')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [stats, setStats] = useState({ total: 0, pending: 0, done: 0, approved: 0, flagged: 0, firstFlagged: null as string | null })

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoadingStep('Fetching project details')
        const { data: p, error: pErr } = await supabase.from('projects').select('*').eq('id', id).single()
        if (pErr) throw pErr
        setProject(p)

        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
           setCurrentUser(user)
           const { data: member } = await supabase.from('project_members').select('role').eq('project_id', id).eq('user_id', user.id).single()
           if (member) setRole(member.role)
        }
        
        // Fetch project members
        setLoadingStep('Fetching project members')
        const memRes = await fetch(`/api/projects/${id}/members`)
        if (memRes.ok) {
          const memData = await memRes.json()
          if (memData.members) {
             setMembers(memData.members)
          }
        }

        // Fetch recent activity
        setLoadingStep('Fetching activity')
        const { data: annotationHistory, error: ahErr } = await supabase.from('annotation_history')
          .select('id, action_type, created_at, created_by, payload, annotations!inner(image_id, images!inner(file_name, project_id))')
          .eq('annotations.images.project_id', id)
          .order('created_at', { ascending: false })
          .limit(10)
          
        const { data: projectHistory, error: phErr } = await supabase.from('project_activity')
          .select('id, action, details, created_at, user_id')
          .eq('project_id', id)
          .order('created_at', { ascending: false })
          .limit(10)
          
        // Collect user IDs to fetch profiles
        const activityUserIds = new Set<string>()
        if (annotationHistory) annotationHistory.forEach((a: any) => activityUserIds.add(a.created_by))
        if (projectHistory) projectHistory.forEach((p: any) => activityUserIds.add(p.user_id))
        
        let profilesMap = new Map()
        if (activityUserIds.size > 0) {
          const { data: profilesData } = await supabase.from('profiles').select('id, username').in('id', Array.from(activityUserIds))
          if (profilesData) {
            profilesMap = new Map(profilesData.map(p => [p.id, p.username]))
          }
        }
          
        const combined = []
        if (annotationHistory) {
           combined.push(...annotationHistory.map((a: any) => ({
             id: a.id,
             type: 'annotation',
             message: `${a.action_type.replace('_', ' ')} on image ${a.annotations?.images?.file_name}`,
             created_at: a.created_at,
             username: profilesMap.get(a.created_by) || 'Someone'
           })))
        }
        if (projectHistory) {
           combined.push(...projectHistory.map((p: any) => ({
             id: p.id,
             type: 'project',
             message: p.details ? `${p.action.replace('_', ' ')}: ${p.details}` : p.action.replace('_', ' '),
             created_at: p.created_at,
             username: profilesMap.get(p.user_id) || 'Someone'
           })))
        }
        
        combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        setActivities(combined.slice(0, 10))

        // Sync missing images from Google Drive BEFORE querying stats.
        // This ensures that when a user switches folders, the new images are
        // in the DB before we count them. Without this await, stats show 0.
        if (p?.drive_image_folder_id) {
          try {
            setLoadingStep('Syncing images from Drive...')
            const listRes = await fetch(`/api/drive/list?folderId=${p.drive_image_folder_id}`)
            const listData = await listRes.json()
            if (listData.files && listData.files.length > 0) {
              const { data: existingAll } = await supabase.from('images').select('drive_file_id, drive_folder_id').eq('project_id', id)
              const existingMap = new Map(existingAll?.map(img => [img.drive_file_id, img.drive_folder_id]) || [])
              
              const missingFiles = listData.files.filter((f: any) => !existingMap.has(f.id))
              const movedFiles = listData.files.filter((f: any) => existingMap.has(f.id) && existingMap.get(f.id) !== p.drive_image_folder_id)

              if (missingFiles.length > 0) {
                const inserts = missingFiles.map((f: any) => ({
                  project_id: id as string,
                  drive_file_id: f.id,
                  file_name: f.name,
                  width: f.imageMediaMetadata?.width ? parseInt(f.imageMediaMetadata.width) : null,
                  height: f.imageMediaMetadata?.height ? parseInt(f.imageMediaMetadata.height) : null,
                  status: 'pending',
                  drive_folder_id: p.drive_image_folder_id
                }))
                await supabase.from('images').insert(inserts)
                toast.success(`Synced ${missingFiles.length} new images from Drive!`)
              }

              if (movedFiles.length > 0) {
                const movedIds = movedFiles.map((f: any) => f.id)
                // Chunk the moved IDs to avoid URL length limits on the IN clause
                const chunkSize = 150
                for (let i = 0; i < movedIds.length; i += chunkSize) {
                  const chunk = movedIds.slice(i, i + chunkSize)
                  await supabase.from('images')
                    .update({ drive_folder_id: p.drive_image_folder_id })
                    .eq('project_id', id)
                    .in('drive_file_id', chunk)
                }
                toast.success(`Re-linked ${movedFiles.length} existing images to this folder.`)
              }
            }
          } catch (syncErr) {
            // Non-fatal: Drive sync failure shouldn't prevent showing existing stats
            console.error('Drive sync failed:', syncErr)
          }
        }

        setLoadingStep('Counting images...')
        // Query images AFTER sync so the count is accurate for the current folder
        const { data: images } = await supabase.from('images').select('id, status').eq('project_id', id).eq('drive_folder_id', p.drive_image_folder_id)
        
        let anns: any[] = [];
        
        setLoadingStep('Calculating stats...')
        if (images) {
           const doneImages = images.filter((i: any) => i.status === 'done')
           const pendingImages = images.filter((i: any) => i.status === 'pending')
           const doneImageIds = doneImages.map((i: any) => i.id)
           
           if (doneImageIds.length > 0) {
              setLoadingStep('Fetching annotations...')
              const chunkSize = 150
              const chunks: string[][] = []
              for (let i = 0; i < doneImageIds.length; i += chunkSize) {
                chunks.push(doneImageIds.slice(i, i + chunkSize))
              }
              // Fetch all chunks in parallel instead of sequentially
              const results = await Promise.all(
                chunks.map(chunk => supabase.from('annotations').select('id, status, image_id').in('image_id', chunk))
              )
              anns = results.flatMap(r => r.data || [])
           }
           
           let approved = 0
           let flagged = 0
           let donePending = 0
           let firstFlagged: string | null = null
           
           if (anns.length > 0) {
              anns.forEach(a => {
                 if (a.status === 'approved') approved++
                 else if (a.status === 'flagged') {
                    flagged++
                    if (!firstFlagged) firstFlagged = a.image_id
                 }
                 else donePending++
              })
           } else {
              donePending = doneImages.length
           }

           setStats({
             total: images.length,
             pending: pendingImages.length,
             done: donePending,
             approved,
             flagged,
             firstFlagged
           })
        }
      } catch(err) {
        console.error(err)
      } finally {
        setLoadingStep('') // empty means done
      }

    }
    loadDashboard()
  }, [id])

  if (loadingStep !== '') return <div className="p-8 text-text-primary">Loading dashboard: {loadingStep}</div>
  if (!project) return (
    <div className="p-8 text-text-primary">
      <h1 className="text-xl font-bold text-accent-red mb-4">Project Not Found!</h1>
      <p>ID: {id}</p>
      <p>This means the Supabase query returned null for this project. Check your Row Level Security (RLS) policies or ensure the project ID is correct.</p>
    </div>
  )

  const progress = stats.total > 0 ? ((stats.done + stats.approved + stats.flagged) / stats.total) * 100 : 0


  return (
    <div className="min-h-screen bg-bg text-text-primary p-8 relative font-body">
      <div className="max-w-[1280px] mx-auto space-y-8 relative z-10">
        
        <div className="flex items-center justify-between mb-4">
           <Link href="/projects" className="text-text-secondary hover:text-text-primary text-sm font-display font-medium transition-all duration-150 ease-out flex items-center gap-2 w-fit">
              <ArrowLeft size={18} strokeWidth={1.5} /> Back to Projects
           </Link>
           <div className="flex items-center gap-4">
             {role === 'owner' && (
               <button onClick={() => setShowSettings(true)} className="text-text-secondary hover:text-text-primary text-sm font-display font-medium transition-all duration-150 ease-out flex items-center gap-1.5">
                 <Settings size={16} strokeWidth={1.5} /> Settings
               </button>
             )}
           </div>
        </div>

        <div className="flex flex-row items-center justify-between bg-surface border border-border p-5 rounded-lg gap-4 overflow-hidden">
          <div className="shrink-0 max-w-[25%] flex flex-col items-start justify-center">
            <h1 className="text-2xl font-display font-semibold text-text-primary mb-1.5 w-full truncate" title={project.name}>
              {project.name}
            </h1>
            <span className="text-[10px] px-2 py-0.5 bg-surface-2 border border-border rounded text-text-secondary font-display uppercase tracking-widest font-semibold">
              Role: {role}
            </span>
          </div>
          <div className="flex items-center justify-end gap-2 flex-nowrap min-w-0">
            <Link href={`/projects/${id}`} className="px-3 py-2 text-sm bg-accent-cyan hover:bg-accent-cyan-hover text-bg font-display font-medium rounded-md flex items-center gap-2 transition-all duration-150 ease-out whitespace-nowrap shrink-0">
              <Layout size={16} strokeWidth={2} /> Enter Workspace
            </Link>
            
            {(role === 'owner' || role === 'reviewer') && (
              <Link href={`/projects/${id}/review`} className="px-3 py-2 text-sm bg-transparent border border-border hover:bg-surface-hover hover:border-accent-cyan text-text-primary font-display font-medium rounded-md flex items-center gap-2 transition-all duration-150 ease-out whitespace-nowrap shrink-0">
                <CheckSquare size={16} strokeWidth={2} className="text-accent-cyan" /> Review Queue
              </Link>
            )}

            {role === 'owner' && (
              <>
                <Link href={`/projects/${id}/taxonomy`} className="px-3 py-2 text-sm bg-transparent border border-border hover:bg-surface-hover hover:border-accent-cyan text-text-primary font-display font-medium rounded-md flex items-center gap-2 transition-all duration-150 ease-out whitespace-nowrap shrink-0">
                  <Network size={16} strokeWidth={2} className="text-text-secondary" /> Classes & CoTs
                </Link>
                <Link href={`/projects/${id}/scene-fields`} className="px-3 py-2 text-sm bg-transparent border border-border hover:bg-surface-hover hover:border-accent-cyan text-text-primary font-display font-medium rounded-md flex items-center gap-2 transition-all duration-150 ease-out whitespace-nowrap shrink-0">
                  <ImageIcon size={16} strokeWidth={2} className="text-text-secondary" /> Scene Fields
                </Link>
              </>
            )}

            {role !== 'reviewer' && (
              <Link href={`/projects/${id}/history`} className="px-3 py-2 text-sm bg-transparent border border-border hover:bg-surface-hover hover:border-accent-cyan text-text-primary font-display font-medium rounded-md flex items-center gap-2 transition-all duration-150 ease-out whitespace-nowrap shrink-0">
                <Clock size={16} strokeWidth={2} className="text-text-secondary" /> Versions
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6">
           <div className="bg-surface border border-border px-6 py-4 rounded-lg flex flex-col justify-between">
             <div className="text-text-secondary text-[11px] font-display uppercase tracking-[0.03em] mb-1">Total Images</div>
             <div className="text-[32px] leading-tight font-data font-medium text-text-primary">{stats.total}</div>
           </div>
           <div className="bg-surface border-t-2 border-t-accent-amber border-r border-b border-l border-border px-6 py-4 rounded-lg flex flex-col justify-between">
             <div className="text-accent-amber text-[11px] font-display uppercase tracking-[0.03em] mb-1 flex items-center gap-2">Pending</div>
             <div className="text-[32px] leading-tight font-data font-medium text-text-primary">{stats.pending}</div>
           </div>
           <div className="bg-surface border-t-2 border-t-accent-green border-r border-b border-l border-border px-6 py-4 rounded-lg flex flex-col justify-between">
             <div className="text-accent-green text-[11px] font-display uppercase tracking-[0.03em] mb-1">Approved</div>
             <div className="text-[32px] leading-tight font-data font-medium text-text-primary">{stats.approved}</div>
           </div>
           <div className="bg-surface border-t-2 border-t-accent-magenta border-r border-b border-l border-border px-6 py-4 rounded-lg flex flex-col justify-between">
             <div className="text-accent-magenta text-[11px] font-display uppercase tracking-[0.03em] mb-1">Flagged</div>
             <div className="text-[32px] leading-tight font-data font-medium text-text-primary">{stats.flagged}</div>
           </div>
        </div>

        {stats.flagged > 0 && stats.firstFlagged && (
          <div className="bg-accent-magenta/10 border border-accent-magenta/50 p-6 rounded-lg flex items-center justify-between">
            <div>
              <div className="text-lg font-display font-medium text-accent-magenta mb-1">Attention Required</div>
              <div className="text-sm text-text-secondary">You have {stats.flagged} flagged image{stats.flagged === 1 ? '' : 's'} that require corrections from the reviewer.</div>
            </div>
            <Link href={`/projects/${id}?imageId=${stats.firstFlagged}`} className="px-6 py-2.5 bg-accent-magenta hover:bg-accent-magenta-hover text-bg text-sm font-display font-medium rounded-md transition-all duration-150 ease-out">
              Fix Flagged Issues
            </Link>
          </div>
        )}

        <div className="bg-surface border border-border p-8 rounded-lg relative overflow-hidden">
           <div className="text-text-primary text-[11px] font-display font-medium uppercase tracking-[0.03em] mb-4 flex justify-between">
              <span>Annotation Progress</span>
              <span className="text-accent-cyan font-data">{progress.toFixed(1)}% Complete</span>
           </div>
           <div className="w-full h-[6px] bg-surface-2 rounded-full overflow-hidden">
             <div className="h-full bg-accent-cyan transition-all duration-1000 ease-out" style={{ width: `${progress}%` }}></div>
           </div>
        </div>

        {role === 'owner' && (
          <div className="bg-surface border border-border p-8 rounded-lg flex items-center justify-between">
             <div>
               <div className="text-lg font-display font-medium text-text-primary mb-2">Export Dataset</div>
               <div className="text-sm text-text-secondary max-w-md leading-relaxed">View your image sources and download completed annotations independently by folder.</div>
             </div>
             <div className="flex gap-4">
               <Link href={`/projects/${id}/export`} className="px-6 py-2.5 bg-accent-cyan hover:bg-accent-cyan-hover text-bg text-sm font-display font-medium rounded-md transition-all duration-150 ease-out flex items-center gap-2">
                 Go to Export Page <ArrowLeft className="rotate-180" size={16} strokeWidth={1.5} />
               </Link>
             </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-surface border border-border p-8 rounded-lg md:col-span-1">
            <h2 className="text-lg font-display font-medium text-text-primary mb-6">Team Members</h2>
            <div className="flex flex-col gap-4">
              {members.map(m => (
                <div key={m.user_id} className="flex items-center justify-between p-4 rounded-md bg-surface-2 border border-border">
                  <div className="font-medium text-text-primary flex items-center gap-2">
                    @{m.profiles?.username || 'unknown'}
                    {currentUser?.id === m.user_id && <span className="text-text-tertiary font-normal text-[11px] italic tracking-normal">(You)</span>}
                  </div>
                  <div className="text-xs px-2 py-1 bg-surface border border-border rounded-md text-text-secondary uppercase tracking-widest">{m.role}</div>
                </div>
              ))}
              {members.length === 0 && <div className="text-text-secondary text-sm">No members found.</div>}
            </div>
          </div>
          <div className="bg-surface border border-border p-8 rounded-lg md:col-span-2">
            <h2 className="text-lg font-display font-medium text-text-primary mb-6">Recent Activity</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {activities.map(a => (
                <div key={a.id} className="flex flex-col gap-1 p-4 rounded-md bg-surface-2 border border-border">
                  <div className="text-sm text-text-primary">
                    <span className="font-medium text-accent-cyan">@{a.username}</span> 
                    {' '}
                    {a.message}
                  </div>
                  <div className="text-[11px] text-text-tertiary font-data mt-1">{new Date(a.created_at).toLocaleString()}</div>
                </div>
              ))}
              {activities.length === 0 && <div className="text-text-secondary text-sm">No recent activity.</div>}
            </div>
          </div>
        </div>
      </div>

      {showSettings && (
        <ProjectSettingsModal 
          projectId={id as string} 
          onClose={() => setShowSettings(false)} 
          onSaved={() => window.location.reload()} 
        />
      )}
    </div>
  )
}
