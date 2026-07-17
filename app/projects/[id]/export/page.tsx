'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'
import { ArrowLeft, Download, Folder } from 'lucide-react'
import { toast } from 'sonner'
import JSZip from 'jszip'

export default function ExportPage() {
  const { id } = useParams()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<any>(null)
  const [folders, setFolders] = useState<any[]>([])
  
  const [format, setFormat] = useState('anytate')
  const [exportingFolder, setExportingFolder] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const { data: p } = await supabase.from('projects').select('*').eq('id', id).single()
        setProject(p)

        // Fetch all images for this project to group them by folder
        const { data: images } = await supabase.from('images').select('id, status, drive_folder_id').eq('project_id', id)
        
        if (images) {
           const folderMap: Record<string, { total: number, done: number }> = {}
           
           images.forEach(img => {
              const folderId = img.drive_folder_id || 'unknown'
              if (!folderMap[folderId]) folderMap[folderId] = { total: 0, done: 0 }
              folderMap[folderId].total++
              if (img.status === 'done') folderMap[folderId].done++
           })
           
           // Resolve paths for each folder ID in parallel
           const folderIds = Object.keys(folderMap)
           const resolvedFolders = await Promise.all(
              folderIds.map(async (folderId) => {
                 let resolvedName = folderId
                 if (folderId === 'unknown') {
                    resolvedName = 'Legacy Import / Unknown Folder'
                 } else {
                    try {
                       const res = await fetch(`/api/drive/folder-path?folderId=${folderId}`)
                       const data = await res.json()
                       if (data.path) resolvedName = data.path
                    } catch (e) {
                       console.error("Failed to resolve folder path", e)
                    }
                 }
                 
                 return {
                    id: folderId,
                    name: resolvedName,
                    total: folderMap[folderId].total,
                    done: folderMap[folderId].done
                 }
              })
           )
           
           setFolders(resolvedFolders)
        }
      } catch (err) {
        console.error(err)
        toast.error("Failed to load export data")
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [id])

  const handleExport = async (folderId: string | null) => {
    try {
      setExportingFolder(folderId || 'all')
      
      const payload: any = { project_id: id, format }
      if (folderId) {
         payload.folder_id = folderId
      }

      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      if (data.files && data.files.length > 0) {
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
         
         toast.success(`Success! Exported ${data.files.length} annotations.`)
      } else {
         toast.error("No annotations found to export.")
      }
    } catch(err: any) {
      toast.error("Export failed: " + err.message)
    } finally {
      setExportingFolder(null)
    }
  }

  if (loading) return <div className="p-8 text-text-primary">Loading export options...</div>

  return (
    <div className="min-h-screen bg-bg text-text-primary p-8 relative font-body">
      <div className="max-w-[1280px] mx-auto space-y-8 relative z-10">
        
        <div className="flex items-center justify-between mb-4">
           <Link href={`/projects/${id}/dashboard`} className="text-text-secondary hover:text-text-primary text-sm font-display font-medium transition-all duration-150 ease-out flex items-center gap-2 w-fit">
              <ArrowLeft size={18} strokeWidth={1.5} /> Back to Dashboard
           </Link>
           <ThemeToggle />
        </div>

        <div className="flex items-center justify-between bg-surface border border-border px-8 py-6 rounded-lg">
          <div>
            <h1 className="text-2xl font-display font-semibold text-text-primary mb-1">Export Annotations</h1>
            <p className="text-sm text-text-secondary">Export your labeled data independently by source folder.</p>
          </div>
          <div className="flex gap-4 items-center">
             <label className="text-sm font-display font-medium text-text-secondary">Export Format:</label>
             <select 
               value={format} 
               onChange={e => setFormat(e.target.value)}
               className="bg-surface-2 border border-border text-sm rounded-md px-4 py-2 font-display outline-none focus:border-accent-cyan"
             >
               <option value="anytate">Anytate JSON</option>
               <option value="yolo">YOLO (TXT)</option>
               <option value="coco">COCO (JSON)</option>
             </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
           {folders.map(folder => (
             <div key={folder.id} className="bg-surface border border-border p-6 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-md bg-surface-2 border border-border flex items-center justify-center">
                     <Folder size={20} className="text-accent-cyan" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-text-primary font-display font-medium">Source: {folder.name}</h3>
                    <p className="text-sm text-text-secondary mt-1">
                      {folder.done} annotations completed out of {folder.total} images
                    </p>
                  </div>
                </div>
                
                <button 
                  onClick={() => handleExport(folder.id)}
                  disabled={exportingFolder === folder.id || folder.done === 0}
                  className="flex items-center gap-2 px-6 py-2.5 bg-accent-cyan hover:bg-accent-cyan-hover text-bg font-display font-medium rounded-md transition-all duration-150 ease-out disabled:opacity-50"
                >
                  {exportingFolder === folder.id ? 'Exporting...' : <><Download size={16} /> Export Folder</>}
                </button>
             </div>
           ))}
           
           {folders.length > 1 && (
             <div className="bg-surface border border-border p-6 rounded-lg flex items-center justify-between mt-4">
                <div>
                  <h3 className="text-text-primary font-display font-medium">Export Entire Project</h3>
                  <p className="text-sm text-text-secondary mt-1">Download all completed annotations across all folders.</p>
                </div>
                
                <button 
                  onClick={() => handleExport(null)}
                  disabled={exportingFolder === 'all'}
                  className="flex items-center gap-2 px-6 py-2.5 bg-transparent border border-border hover:bg-surface-hover hover:border-accent-cyan text-text-primary font-display font-medium rounded-md transition-all duration-150 ease-out disabled:opacity-50"
                >
                  {exportingFolder === 'all' ? 'Exporting...' : <><Download size={16} /> Export All</>}
                </button>
             </div>
           )}
           
           {folders.length === 0 && (
             <div className="bg-surface border border-border p-8 rounded-lg text-center">
                <p className="text-text-secondary">No images found in this project.</p>
             </div>
           )}
        </div>
      </div>
    </div>
  )
}
