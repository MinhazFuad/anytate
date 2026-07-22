'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'
import { ArrowLeft, Folder, ChevronRight, FolderPlus } from 'lucide-react'
import { toast } from 'sonner'

export default function NewProjectPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  
  // Form State
  const [projectName, setProjectName] = useState('')
  const [soloMode, setSoloMode] = useState(false)
  const [maxDim, setMaxDim] = useState(1024)
  const [jpegQuality, setJpegQuality] = useState(85)
  
  // Drive Browser State
  const [folders, setFolders] = useState<any[]>([])
  const [path, setPath] = useState<{id: string, name: string}[]>([{id: 'root', name: 'My Drive'}])
  const [loadingFolders, setLoadingFolders] = useState(true)
  const [selectedFolderId, setSelectedFolderId] = useState<string>('')

  const currentFolder = path[path.length - 1]

  useEffect(() => {
    async function fetchFolders(parentId: string) {
      setLoadingFolders(true)
      try {
        const res = await fetch(`/api/drive/folders?parentId=${parentId}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to fetch folders")
        setFolders(data.folders || [])
      } catch (err: any) {
        toast.error("Drive Error: " + err.message)
      } finally {
        setLoadingFolders(false)
      }
    }
    fetchFolders(currentFolder.id)
  }, [currentFolder.id])

  const navigateTo = (folderId: string, folderName: string) => {
    setPath(prev => [...prev, { id: folderId, name: folderName }])
    setSelectedFolderId(folderId)
  }

  const navigateToBreadcrumb = (index: number) => {
    setPath(prev => {
       const newPath = prev.slice(0, index + 1)
       setSelectedFolderId(newPath[newPath.length - 1].id)
       return newPath
    })
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectName.trim()) return toast.error("Please provide a project name")
    if (!selectedFolderId) return toast.error("Please select a Google Drive folder")
    
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { data: project, error: pErr } = await supabase.from('projects').insert({
        name: projectName,
        owner_id: user.id,
        solo_mode: soloMode,
        drive_image_folder_id: selectedFolderId,
        preprocessing: {
          max_dim: maxDim,
          jpeg_quality: jpegQuality
        }
      }).select().single()

      if (pErr) throw pErr

      // Add user as owner in project_members
      const { error: mErr } = await supabase.from('project_members').insert({
        project_id: project.id,
        user_id: user.id,
        role: 'owner'
      })
      if (mErr) throw mErr

      toast.success("Project created successfully!")
      router.push(`/projects/${project.id}/taxonomy`)
    } catch (err: any) {
      toast.error(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary p-8 relative font-body">
      <div className="max-w-[1280px] mx-auto space-y-8 relative z-10">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
           <Link href={`/projects`} className="text-text-secondary hover:text-text-primary text-sm font-display font-medium transition-all duration-150 ease-out flex items-center gap-2 w-fit">
              <ArrowLeft size={18} strokeWidth={1.5} /> Back to Projects
           </Link>
        </div>

        <div>
          <h1 className="text-2xl font-display font-semibold text-text-primary">Create New Project</h1>
          <p className="text-sm text-text-secondary mt-1">Configure your annotation workspace and connect it to Google Drive.</p>
        </div>

        <form onSubmit={handleCreate}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Settings */}
            <div className="lg:col-span-1 space-y-6">
          
          {/* General Settings */}
          <div className="bg-surface border border-border p-6 rounded-lg space-y-4">
            <h2 className="text-lg font-display font-medium text-text-primary border-b border-border pb-2">General Info</h2>
            
            <div className="space-y-2">
              <label className="text-xs uppercase font-display font-semibold tracking-[0.03em] text-text-secondary">Project Name</label>
              <input 
                type="text" 
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Traffic Camera Object Detection"
                className="w-full h-9 bg-surface-2 border border-border rounded px-4 text-sm font-body text-text-primary focus:border-accent-cyan outline-none transition-colors duration-150 ease-out"
                required
              />
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-between">
              <div>
                <label className="text-sm font-display font-medium text-text-primary flex items-center gap-2">
                  Solo Mode (Bypass Review Queue)
                </label>
                <p className="text-xs text-text-secondary mt-1 max-w-[400px]">When enabled, clicking &quot;Save&quot; on an image instantly marks it as <span className="font-data text-accent-green">approved</span> instead of pending review.</p>
              </div>
              
              <button 
                type="button"
                onClick={() => setSoloMode(!soloMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${soloMode ? 'bg-accent-cyan' : 'bg-surface-2 border border-border'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-bg transition-transform ${soloMode ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

          {/* Preprocessing Settings (Moved to left column) */}
          <div className="bg-surface border border-border p-6 rounded-lg space-y-4">
            <h2 className="text-lg font-display font-medium text-text-primary border-b border-border pb-2">Image Preprocessing</h2>
            <p className="text-sm text-text-secondary mb-4">These variables control how images are scaled before they are presented in the canvas. You can change these later in Project Settings.</p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs uppercase font-display font-semibold tracking-[0.03em] text-text-secondary">Preferred Max Px</label>
                <input 
                  type="number" 
                  value={maxDim}
                  onChange={(e) => setMaxDim(parseInt(e.target.value) || 1024)}
                  className="w-full h-9 bg-surface-2 border border-border rounded px-4 text-sm font-data text-text-primary focus:border-accent-cyan outline-none transition-colors duration-150 ease-out"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase font-display font-semibold tracking-[0.03em] text-text-secondary">JPEG Quality</label>
                <input 
                  type="number" 
                  min="1" max="100"
                  value={jpegQuality}
                  onChange={(e) => setJpegQuality(parseInt(e.target.value) || 85)}
                  className="w-full h-9 bg-surface-2 border border-border rounded px-4 text-sm font-data text-text-primary focus:border-accent-cyan outline-none transition-colors duration-150 ease-out"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Drive Browser & Submit */}
        <div className="lg:col-span-2 space-y-6 flex flex-col">
          {/* Drive Browser */}
          <div className="bg-surface border border-border p-6 rounded-lg space-y-4">
            <h2 className="text-lg font-display font-medium text-text-primary border-b border-border pb-2">Image Source (Google Drive)</h2>
            <p className="text-sm text-text-secondary mb-2">Browse your Google Drive and select the folder containing your images.</p>
            
            {/* Browser UI */}
            <div className="border border-border rounded overflow-hidden bg-surface-2 flex-1 flex flex-col">
               {/* Breadcrumbs */}
               <div className="flex items-center gap-1 p-3 border-b border-border bg-surface text-sm font-display font-medium text-text-secondary overflow-x-auto whitespace-nowrap scrollbar-hide">
                 {path.map((crumb, idx) => (
                   <div key={crumb.id} className="flex items-center">
                     <button 
                       type="button" 
                       onClick={() => navigateToBreadcrumb(idx)}
                       className={`hover:text-text-primary transition-colors ${idx === path.length - 1 ? 'text-text-primary' : ''}`}
                     >
                       {crumb.name}
                     </button>
                     {idx < path.length - 1 && <ChevronRight size={16} className="mx-1 opacity-50" />}
                   </div>
                 ))}
               </div>

               {/* Folder List */}
               <div className="h-64 overflow-y-auto p-2">
                 {loadingFolders ? (
                   <div className="h-full flex items-center justify-center text-sm text-text-tertiary">Loading folders...</div>
                 ) : folders.length === 0 ? (
                   <div className="h-full flex items-center justify-center text-sm text-text-tertiary italic">No folders found here.</div>
                 ) : (
                   <div className="grid grid-cols-1 gap-1">
                     {folders.map(folder => (
                       <div 
                         key={folder.id} 
                         onClick={() => setSelectedFolderId(folder.id)}
                         onDoubleClick={() => navigateTo(folder.id, folder.name)}
                         className={`flex items-center gap-3 p-2 rounded-md cursor-pointer select-none transition-colors border ${selectedFolderId === folder.id ? 'bg-accent-cyan-muted border-accent-cyan text-accent-cyan' : 'border-transparent hover:bg-surface-hover text-text-primary'}`}
                       >
                         <Folder size={18} strokeWidth={1.5} className={selectedFolderId === folder.id ? 'text-accent-cyan' : 'text-text-secondary'} />
                         <span className={`text-sm font-body truncate flex-1 ${selectedFolderId === folder.id ? 'font-medium' : ''}`}>{folder.name}</span>
                       </div>
                     ))}
                   </div>
                 )}
               </div>
               {/* Selected Footer */}
               <div className="p-4 border-t border-border bg-surface flex items-center justify-between">
                 <div className="flex flex-col">
                   <span className="text-[11px] text-text-secondary font-display font-semibold uppercase tracking-[0.03em] mb-1">Target Folder</span>
                   <span className="text-sm font-data text-text-primary font-medium flex items-center gap-2">
                     <Folder size={14} className="text-accent-cyan" />
                     {selectedFolderId === currentFolder.id 
                       ? currentFolder.name 
                       : (folders.find(f => f.id === selectedFolderId)?.name || path.find(p => p.id === selectedFolderId)?.name || 'Unknown')}
                   </span>
                 </div>
                 <button 
                   type="button"
                   onClick={() => setSelectedFolderId(currentFolder.id)}
                   disabled={selectedFolderId === currentFolder.id}
                   className="h-9 px-4 bg-surface-2 border border-border rounded text-sm font-display font-medium text-text-primary hover:bg-surface-hover hover:border-text-tertiary disabled:opacity-50 transition-colors duration-150 ease-out active:scale-[0.98]"
                 >
                   Select Current Folder
                 </button>
               </div>
            </div>
          </div>
          
          <div className="flex justify-end pt-4 mt-auto">
            <button 
              type="submit"
              disabled={loading || !selectedFolderId}
              className="flex items-center gap-2 h-9 px-6 bg-accent-cyan text-bg rounded text-sm font-display font-semibold hover:bg-accent-cyan-hover transition-colors duration-150 ease-out active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
            >
              {loading ? 'Creating...' : <><FolderPlus size={18} /> Create Project</>}
            </button>
          </div>
        </div>
      </div>
    </form>
      </div>
    </div>
  )
}
