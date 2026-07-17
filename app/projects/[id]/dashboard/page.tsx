'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'
import JSZip from 'jszip'
import { toast } from 'sonner'
import { ArrowLeft, Clock, Download } from 'lucide-react'

export default function ProjectDashboardPage() {
  const { id } = useParams()
  const supabase = createClient()
  
  const [loadingStep, setLoadingStep] = useState<string>('Initializing...')
  const [project, setProject] = useState<any>(null)
  const [stats, setStats] = useState({ total: 0, pending: 0, done: 0, approved: 0, flagged: 0 })

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoadingStep('Fetching project details...')
        const { data: p } = await supabase.from('projects').select('*').eq('id', id).single()
        setProject(p)

        // Background: Sync missing images from Google Drive
        if (p?.drive_image_folder_id) {
          fetch(`/api/drive/list?folderId=${p.drive_image_folder_id}`)
            .then(res => res.json())
            .then(async listData => {
              if (listData.files) {
                const { data: existingAll } = await supabase.from('images').select('drive_file_id').eq('project_id', id)
                const existingIds = new Set(existingAll?.map(img => img.drive_file_id) || [])
                const missingFiles = listData.files.filter((f: any) => !existingIds.has(f.id))
                if (missingFiles.length > 0) {
                  const inserts = missingFiles.map((f: any) => ({
                    project_id: id as string,
                    drive_file_id: f.id,
                    file_name: f.name,
                    status: 'pending',
                    drive_folder_id: p.drive_image_folder_id
                  }))
                  await supabase.from('images').insert(inserts)
                  
                  // Update the UI since this was a new project or had new files
                  setStats(prev => ({
                    ...prev,
                    total: prev.total + missingFiles.length,
                    pending: prev.pending + missingFiles.length
                  }))
                  toast.success(`Successfully synced ${missingFiles.length} new images from Drive!`)
                }
              }
            }).catch(console.error)
        }

        setLoadingStep('Counting images...')
        // Count images by status
        const { data: images } = await supabase.from('images').select('id, status').eq('project_id', id).eq('drive_folder_id', p.drive_image_folder_id)
        
        let anns: any[] = [];
        
        setLoadingStep('Calculating stats...')
        // Let's do it safely
        if (images) {
           const doneImages = images.filter((i: any) => i.status === 'done')
           const pendingImages = images.filter((i: any) => i.status === 'pending')
           const doneImageIds = doneImages.map((i: any) => i.id)
           
           if (doneImageIds.length > 0) {
              setLoadingStep('Fetching annotations in batches...')
              // Chunk the IDs into batches of 150 to prevent URL length limits in Supabase GET requests
              const chunkSize = 150
              for (let i = 0; i < doneImageIds.length; i += chunkSize) {
                 const chunk = doneImageIds.slice(i, i + chunkSize)
                 const { data } = await supabase.from('annotations').select('id, status, image_id').in('image_id', chunk);
                 if (data) anns.push(...data)
              }
           }
           
           let approved = 0
           let flagged = 0
           let donePending = 0 // done annotating, pending review
           
           if (anns.length > 0) {
              anns.forEach(a => {
                 if (a.status === 'approved') approved++
                 else if (a.status === 'flagged') flagged++
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
             flagged
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
           <ThemeToggle />
        </div>

        <div className="flex items-center justify-between bg-surface border border-border px-8 py-6 rounded-lg">
          <div>
            <h1 className="text-2xl font-display font-semibold text-text-primary mb-1">{project.name}</h1>
            <p className="text-sm text-text-secondary">Project Dashboard overview</p>
          </div>
          <div className="flex gap-4">
            <Link href={`/projects/${id}`} className="px-6 py-2.5 bg-accent-cyan hover:bg-accent-cyan-hover text-bg font-display font-medium rounded-md flex items-center justify-center transition-all duration-150 ease-out">
              Enter Workspace
            </Link>
            <Link href={`/projects/${id}/review`} className="px-6 py-2.5 bg-transparent border border-border hover:bg-surface-hover hover:border-accent-cyan text-text-primary font-display font-medium rounded-md transition-all duration-150 ease-out">
              Review Queue
            </Link>
            <Link href={`/projects/${id}/taxonomy`} className="px-6 py-2.5 bg-transparent border border-border hover:bg-surface-hover hover:border-accent-cyan text-text-primary font-display font-medium rounded-md transition-all duration-150 ease-out">
              FCOT Taxonomy
            </Link>
            <Link href={`/projects/${id}/scene-fields`} className="px-6 py-2.5 bg-transparent border border-border hover:bg-surface-hover hover:border-accent-cyan text-text-primary font-display font-medium rounded-md transition-all duration-150 ease-out">
              Scene Fields
            </Link>
            <Link href={`/projects/${id}/history`} className="px-6 py-2.5 bg-transparent border border-border hover:bg-surface-hover hover:border-accent-cyan text-text-primary font-display font-medium rounded-md flex items-center gap-2 transition-all duration-150 ease-out">
              <Clock size={16} className="text-accent-cyan" strokeWidth={1.5} /> Provenance
            </Link>
            <Link href={`/projects/${id}/settings`} className="px-6 py-2.5 bg-transparent border border-border hover:bg-surface-hover hover:border-accent-cyan text-text-primary font-display font-medium rounded-md transition-all duration-150 ease-out">
              Settings
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6">
           <div className="bg-surface border border-border p-6 rounded-lg flex flex-col justify-between">
             <div className="text-text-secondary text-[11px] font-display uppercase tracking-[0.03em] mb-2">Total Images</div>
             <div className="text-[34px] font-data font-medium text-text-primary">{stats.total}</div>
           </div>
           <div className="bg-surface border-t-2 border-t-accent-amber border-r border-b border-l border-border p-6 rounded-lg flex flex-col justify-between">
             <div className="text-accent-amber text-[11px] font-display uppercase tracking-[0.03em] mb-2 flex items-center gap-2">Pending</div>
             <div className="text-[34px] font-data font-medium text-text-primary">{stats.pending}</div>
           </div>
           <div className="bg-surface border-t-2 border-t-accent-green border-r border-b border-l border-border p-6 rounded-lg flex flex-col justify-between">
             <div className="text-accent-green text-[11px] font-display uppercase tracking-[0.03em] mb-2">Approved</div>
             <div className="text-[34px] font-data font-medium text-text-primary">{stats.approved}</div>
           </div>
           <div className="bg-surface border-t-2 border-t-accent-magenta border-r border-b border-l border-border p-6 rounded-lg flex flex-col justify-between">
             <div className="text-accent-magenta text-[11px] font-display uppercase tracking-[0.03em] mb-2">Flagged</div>
             <div className="text-[34px] font-data font-medium text-text-primary">{stats.flagged}</div>
           </div>
        </div>

        <div className="bg-surface border border-border p-8 rounded-lg relative overflow-hidden">
           <div className="text-text-primary text-[11px] font-display font-medium uppercase tracking-[0.03em] mb-4 flex justify-between">
              <span>Annotation Progress</span>
              <span className="text-accent-cyan font-data">{progress.toFixed(1)}% Complete</span>
           </div>
           <div className="w-full h-[6px] bg-surface-2 rounded-full overflow-hidden">
             <div className="h-full bg-accent-cyan transition-all duration-1000 ease-out" style={{ width: `${progress}%` }}></div>
           </div>
        </div>

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
      </div>
    </div>
  )
}
