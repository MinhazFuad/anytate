'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'
import { toast } from 'sonner'
import { ArrowLeft, Trash2, Save, AlertTriangle, Folder, ChevronRight } from 'lucide-react'

export default function ProjectSettingsPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [project, setProject] = useState<any>(null)

  const [projectName, setProjectName] = useState('')
  const [driveFolderId, setDriveFolderId] = useState('')
  const [maxDim, setMaxDim] = useState(1024)
  const [jpegQuality, setJpegQuality] = useState(85)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  // Drive Browser State
  const [folders, setFolders] = useState<any[]>([])
  const [path, setPath] = useState<{id: string, name: string}[]>([{id: 'root', name: 'My Drive'}])
  const [loadingFolders, setLoadingFolders] = useState(true)

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
    setDriveFolderId(folderId)
  }

  const navigateToBreadcrumb = (index: number) => {
    setPath(prev => {
      const newPath = prev.slice(0, index + 1)
      setDriveFolderId(newPath[newPath.length - 1].id)
      return newPath
    })
  }

  useEffect(() => {
    async function loadProject() {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single()
        
      if (error) {
        toast.error("Error loading project")
        return
      }

      setProject(data)
      setProjectName(data.name || '')
      setDriveFolderId(data.drive_image_folder_id || '')
      setMaxDim(data.preprocessing?.max_dim || 1024)
      setJpegQuality(data.preprocessing?.jpeg_quality || 85)
      
      setLoading(false)
    }
    loadProject()
  }, [id])

  const handleSaveSettings = async () => {
    try {
      setSaving(true)
      const { error } = await supabase
        .from('projects')
        .update({
          name: projectName,
          drive_image_folder_id: driveFolderId,
          preprocessing: {
            max_dim: maxDim,
            jpeg_quality: jpegQuality
          }
        })
        .eq('id', id)

      if (error) throw error
      toast.success("Project settings updated successfully")
      router.refresh()
      setTimeout(() => {
         router.push(`/projects/${id}/dashboard`)
      }, 100)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteProject = async () => {
    if (deleteConfirmText !== project.name) {
      toast.error("Project name does not match")
      return
    }

    try {
      setDeleting(true)
      // Call secure API to handle cascading deletes
      const res = await fetch(`/api/projects/${id}/delete`, {
        method: 'DELETE'
      })
      
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to delete project")
      }
      
      toast.success("Project deleted successfully")
      router.push('/projects')
    } catch (err: any) {
      toast.error(err.message)
      setDeleting(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-bg flex items-center justify-center text-text-primary">Loading settings...</div>

  return (
    <div className="min-h-screen bg-bg text-text-primary p-8 font-body">
      <div className="max-w-[800px] mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
           <Link href={`/projects/${id}/dashboard`} className="text-text-secondary hover:text-text-primary text-sm font-display font-medium transition-all duration-150 ease-out flex items-center gap-2 w-fit">
              <ArrowLeft size={18} strokeWidth={1.5} /> Back to Dashboard
           </Link>
           <ThemeToggle />
        </div>

        <div>
          <h1 className="text-2xl font-display font-semibold text-text-primary">Project Settings</h1>
          <p className="text-sm text-text-secondary mt-1">Manage project lifecycle and image preprocessing variables.</p>
        </div>

        <div className="space-y-6">
          
          {/* General Settings */}
          <div className="bg-surface border border-border p-6 rounded-lg space-y-4">
            <h2 className="text-lg font-display font-medium text-text-primary border-b border-border pb-2">General</h2>
            
            <div className="space-y-2">
              <label className="text-xs uppercase font-display font-semibold tracking-[0.03em] text-text-secondary">Project Name</label>
              <input 
                type="text" 
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-md px-4 py-2.5 text-sm font-body text-text-primary focus:border-accent-cyan outline-none transition-colors"
              />
            </div>

          </div>

          {/* Drive Browser */}
          <div className="bg-surface border border-border p-6 rounded-lg space-y-4">
            <h2 className="text-lg font-display font-medium text-text-primary border-b border-border pb-2">Image Source (Google Drive)</h2>
            <p className="text-sm text-text-secondary mb-2">Change the Google Drive folder for this project. If you select a new folder, it will sync images on your next visit to the dashboard.</p>
            
            {/* Browser UI */}
            <div className="border border-border rounded-md overflow-hidden bg-surface-2">
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
                         onClick={() => setDriveFolderId(folder.id)}
                         onDoubleClick={() => navigateTo(folder.id, folder.name)}
                         className={`flex items-center gap-3 p-2 rounded-md cursor-pointer select-none transition-colors border ${driveFolderId === folder.id ? 'bg-accent-cyan-muted border-accent-cyan text-accent-cyan' : 'border-transparent hover:bg-surface-hover text-text-primary'}`}
                       >
                         <Folder size={18} strokeWidth={1.5} className={driveFolderId === folder.id ? 'text-accent-cyan' : 'text-text-secondary'} />
                         <span className="text-sm font-body truncate flex-1">{folder.name}</span>
                         <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); navigateTo(folder.id, folder.name); }}
                            className="p-1 hover:bg-surface rounded opacity-0 group-hover:opacity-100 transition-opacity"
                         >
                            <ChevronRight size={16} className="text-text-tertiary" />
                         </button>
                       </div>
                     ))}
                   </div>
                 )}
               </div>
               {/* Selected Footer */}
               <div className="p-3 border-t border-border bg-surface text-xs font-display flex items-center justify-between">
                 <span className="text-text-secondary uppercase tracking-[0.03em] font-semibold">Selected Folder</span>
                 <span className="font-data text-accent-cyan px-2 py-0.5 bg-accent-cyan-muted rounded-sm border border-accent-cyan/20 truncate max-w-[200px]" title={driveFolderId}>
                   {path.find(p => p.id === driveFolderId)?.name || 'Selected from outside'}
                 </span>
               </div>
            </div>
          </div>

          {/* Preprocessing Settings */}
          <div className="bg-surface border border-border p-6 rounded-lg space-y-4">
            <h2 className="text-lg font-display font-medium text-text-primary border-b border-border pb-2">Image Preprocessing</h2>
            <p className="text-sm text-text-secondary mb-4">These variables control how images are scaled before they are presented in the canvas.</p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs uppercase font-display font-semibold tracking-[0.03em] text-text-secondary">Max Dimension (px)</label>
                <input 
                  type="number" 
                  value={maxDim}
                  onChange={(e) => setMaxDim(parseInt(e.target.value) || 1024)}
                  className="w-full bg-surface-2 border border-border rounded-md px-4 py-2.5 text-sm font-data text-text-primary focus:border-accent-cyan outline-none transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase font-display font-semibold tracking-[0.03em] text-text-secondary">JPEG Quality</label>
                <input 
                  type="number" 
                  min="1" max="100"
                  value={jpegQuality}
                  onChange={(e) => setJpegQuality(parseInt(e.target.value) || 85)}
                  className="w-full bg-surface-2 border border-border rounded-md px-4 py-2.5 text-sm font-data text-text-primary focus:border-accent-cyan outline-none transition-colors"
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end pt-2">
            <button 
              onClick={handleSaveSettings}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-accent-cyan text-bg rounded-md text-sm font-display font-semibold hover:bg-accent-cyan-hover transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : <><Save size={16} /> Save Changes</>}
            </button>
          </div>

          {/* Danger Zone */}
          <div className="bg-surface border border-accent-red/30 p-6 rounded-lg space-y-4 mt-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-accent-red"></div>
            <h2 className="text-lg font-display font-medium text-accent-red flex items-center gap-2">
              <AlertTriangle size={18} /> Danger Zone
            </h2>
            <p className="text-sm text-text-secondary">
              Deleting this project will permanently remove all images, taxonomy versions, scene metadata, drafts, and annotations associated with it. This action <strong>cannot</strong> be undone.
            </p>
            
            <div className="space-y-2 pt-2">
              <label className="text-xs font-display font-semibold text-text-secondary">
                Type <span className="font-data text-text-primary px-1">{project?.name}</span> to confirm
              </label>
              <div className="flex gap-4">
                <input 
                  type="text" 
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="flex-1 bg-surface-2 border border-border rounded-md px-4 py-2.5 text-sm font-body text-text-primary focus:border-accent-red outline-none transition-colors"
                />
                <button 
                  onClick={handleDeleteProject}
                  disabled={deleting || deleteConfirmText !== project?.name}
                  className="flex items-center gap-2 px-6 py-2.5 bg-transparent border border-accent-red text-accent-red rounded-md text-sm font-display font-semibold hover:bg-accent-red/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? 'Deleting...' : <><Trash2 size={16} /> Delete Project</>}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
