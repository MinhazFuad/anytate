'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import JSZip from 'jszip'

export default function ProjectDashboardPage() {
  const { id } = useParams()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<any>(null)
  const [stats, setStats] = useState({ total: 0, pending: 0, done: 0, approved: 0, flagged: 0 })

  useEffect(() => {
    async function loadDashboard() {
      try {
        const { data: p } = await supabase.from('projects').select('*').eq('id', id).single()
        setProject(p)

        // 1. Sync missing images from Google Drive so the dashboard total is accurate
        const listRes = await fetch(`/api/drive/list?folderId=${p.drive_image_folder_id}`)
        const listData = await listRes.json()
        
        if (listRes.ok && listData.files) {
          const { data: existingAll } = await supabase.from('images').select('drive_file_id').eq('project_id', id)
          const existingIds = new Set(existingAll?.map(img => img.drive_file_id) || [])
          
          const missingFiles = listData.files.filter((f: any) => !existingIds.has(f.id))
          
          if (missingFiles.length > 0) {
            const inserts = missingFiles.map((f: any) => ({
              project_id: id as string,
              drive_file_id: f.id,
              file_name: f.name,
              status: 'pending'
            }))
            await supabase.from('images').insert(inserts)
          }
        }

        // Count images by status
        const { data: images } = await supabase.from('images').select('id, status').eq('project_id', id)
        const { data: anns } = await supabase.from('annotations').select('id, status').eq('image_id', 'in', `(${images?.map(i => i.id).join(',')} )`) // This is a bit hacky, let's just query normally
        
        // Let's do it safely
        if (images) {
           const doneImages = images.filter(i => i.status === 'done')
           const pendingImages = images.filter(i => i.status === 'pending')
           
           // Fetch annotations for done images
           const { data: annotations } = await supabase.from('annotations').select('id, status, image_id')
           
           let approved = 0
           let flagged = 0
           let donePending = 0 // done annotating, pending review
           
           annotations?.forEach(a => {
              if (doneImages.find(i => i.id === a.image_id)) {
                 if (a.status === 'approved') approved++
                 else if (a.status === 'flagged') flagged++
                 else donePending++
              }
           })

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
        setLoading(false)
      }
    }
    loadDashboard()
  }, [id, supabase])

  if (loading) return <div className="p-8 text-white">Loading dashboard...</div>
  if (!project) return <div className="p-8 text-white">Project not found</div>

  const progress = stats.total > 0 ? ((stats.done + stats.approved + stats.flagged) / stats.total) * 100 : 0

  const handleExport = async (format: string) => {
    try {
      alert(`Starting export to ${format.toUpperCase()}...`)
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: id, format })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      if (data.files && data.files.length > 0) {
         // Create zip
         const zip = new JSZip()
         data.files.forEach((file: any) => {
            zip.file(file.name, file.content)
         })
         
         const blob = await zip.generateAsync({ type: 'blob' })
         const url = URL.createObjectURL(blob)
         const a = document.createElement('a')
         a.href = url
         a.download = data.zipFilename
         document.body.appendChild(a)
         a.click()
         a.remove()
         URL.revokeObjectURL(url)
         
         alert(`Success! Exported ${data.files.length} files as ${data.zipFilename}.`)
      } else {
         alert("No annotations found to export.")
      }
    } catch(err: any) {
      alert("Export failed: " + err.message)
    }
  }

  return (
    <div className="min-h-screen bg-black/50 text-white p-8 relative">
      <div className="max-w-5xl mx-auto space-y-8 relative z-10">
        <div className="mb-4">
           <Link href="/projects" className="text-muted hover:text-white text-sm font-semibold transition-colors flex items-center gap-2 w-fit">
              <span className="text-xl">←</span> All Projects
           </Link>
        </div>
        <div className="flex items-center justify-between glass px-8 py-6 rounded-3xl">
          <div>
            <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-accent to-purple-400 mb-2">{project.name}</h1>
            <p className="text-sm text-muted">Project Dashboard overview</p>
          </div>
          <div className="flex gap-4">
            <Link href={`/projects/${id}`} className="px-6 py-3 btn-premium text-white font-bold rounded-xl shadow-lg">
              Enter Workspace
            </Link>
            <Link href={`/projects/${id}/review`} className="px-6 py-3 glass glass-interactive text-white font-bold rounded-xl">
              Review Queue
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6">
           <div className="glass glass-interactive p-6 rounded-2xl flex flex-col justify-between">
             <div className="text-muted text-xs font-bold uppercase tracking-wider mb-2">Total Images</div>
             <div className="text-5xl font-extrabold text-white">{stats.total}</div>
           </div>
           <div className="glass glass-interactive p-6 rounded-2xl flex flex-col justify-between border-t-2 border-t-accent/50">
             <div className="text-accent text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span> Pending</div>
             <div className="text-5xl font-extrabold text-white">{stats.pending}</div>
           </div>
           <div className="glass glass-interactive p-6 rounded-2xl flex flex-col justify-between border-t-2 border-t-green-500/50">
             <div className="text-green-500 text-xs font-bold uppercase tracking-wider mb-2">Approved</div>
             <div className="text-5xl font-extrabold text-white">{stats.approved}</div>
           </div>
           <div className="glass glass-interactive p-6 rounded-2xl flex flex-col justify-between border-t-2 border-t-warn/50">
             <div className="text-warn text-xs font-bold uppercase tracking-wider mb-2">Flagged</div>
             <div className="text-5xl font-extrabold text-white">{stats.flagged}</div>
           </div>
        </div>

        <div className="glass p-8 rounded-3xl relative overflow-hidden">
           <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-purple-500/5 pointer-events-none"></div>
           <div className="text-white text-sm font-bold uppercase tracking-widest mb-6 flex justify-between">
              <span>Annotation Progress</span>
              <span className="text-accent">{progress.toFixed(1)}% Complete</span>
           </div>
           <div className="w-full h-3 bg-black/50 rounded-full overflow-hidden border border-white/5 shadow-inner">
             <div className="h-full bg-gradient-to-r from-accent via-blue-500 to-purple-500 shadow-[0_0_15px_rgba(56,189,248,0.8)] transition-all duration-1000 ease-out" style={{ width: `${progress}%` }}></div>
           </div>
        </div>

        <div className="glass p-8 rounded-3xl flex items-center justify-between">
           <div>
             <div className="text-lg font-bold text-white mb-2">Export Dataset</div>
             <div className="text-sm text-muted max-w-md leading-relaxed">Download your completed annotations directly as a Zip archive containing individual files for each image.</div>
           </div>
           <div className="flex gap-4">
             <button onClick={() => handleExport('coco')} className="px-5 py-2.5 glass glass-interactive text-white text-sm font-bold rounded-xl">
               COCO
             </button>
             <button onClick={() => handleExport('yolo')} className="px-5 py-2.5 glass glass-interactive text-white text-sm font-bold rounded-xl">
               YOLO
             </button>
             <button onClick={() => handleExport('anytate')} className="px-5 py-2.5 btn-premium text-white text-sm font-bold rounded-xl">
               Anytate JSON
             </button>
           </div>
        </div>
      </div>
    </div>
  )
}
