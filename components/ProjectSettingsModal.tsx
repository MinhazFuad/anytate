'use client'

import { useEffect, useState } from 'react'

import { createClient } from '@/lib/supabase/client'


import { toast } from 'sonner'
import { X, Trash2, Save, AlertTriangle, Folder, ChevronRight } from 'lucide-react'

export default function ProjectSettingsModal({ 
  projectId: id, 
  onClose, 
  onSaved 
}: { 
  projectId: string, 
  onClose: () => void,
  onSaved: () => void 
}) {
      const supabase = createClient()
  
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setIsOpen(true), 10);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, 300);
  };

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [project, setProject] = useState<any>(null)

  const [projectName, setProjectName] = useState('')
  const [soloMode, setSoloMode] = useState(false)
  const [driveFolderId, setDriveFolderId] = useState('')
  const [maxDim, setMaxDim] = useState(1024)
  const [jpegQuality, setJpegQuality] = useState(85)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  // Team State
  const [members, setMembers] = useState<any[]>([])
  const [invites, setInvites] = useState<any[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('annotator')
  const [inviting, setInviting] = useState(false)

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
      setSoloMode(data.solo_mode || false)
      setDriveFolderId(data.drive_image_folder_id || '')
      setMaxDim(data.preprocessing?.max_dim || 1024)
      setJpegQuality(data.preprocessing?.jpeg_quality || 85)
      
      setLoading(false)
    }

    async function loadMembers() {
      const res = await fetch(`/api/projects/${id}/members`)
      if (res.ok) {
        const data = await res.json()
        setMembers(data.members || [])
      }
    }

    async function loadInvites() {
      const res = await fetch(`/api/projects/${id}/invites`)
      if (res.ok) {
        const data = await res.json()
        setInvites(data.invites || [])
      }
    }

    loadProject()
    loadMembers()
    loadInvites()
  }, [id])

  const handleSaveSettings = async () => {
    try {
      setSaving(true)
      const { error } = await supabase
        .from('projects')
        .update({
          name: projectName,
          solo_mode: soloMode,
          drive_image_folder_id: driveFolderId,
          preprocessing: {
            max_dim: maxDim,
            jpeg_quality: jpegQuality
          }
        })
        .eq('id', id)

      if (error) throw error
      toast.success("Project settings updated successfully")
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail) return
    try {
      setInviting(true)
      const res = await fetch(`/api/projects/${id}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send invite')

      toast.success(`Invite sent to ${inviteEmail}!`)
      setInviteEmail('')
      const iRes = await fetch(`/api/projects/${id}/invites`)
      if (iRes.ok) {
        const iData = await iRes.json()
        setInvites(iData.invites || [])
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setInviting(false)
    }
  }

  const handleRevokeInvite = async (inviteId: string) => {
    if (!confirm('Revoke this invite?')) return
    try {
      const res = await fetch(`/api/projects/${id}/invites?inviteId=${inviteId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to revoke invite')
      }
      toast.success('Invite revoked')
      setInvites(prev => prev.filter(i => i.id !== inviteId))
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return
    try {
      const res = await fetch(`/api/projects/${id}/members/delete?userId=${userId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to remove member')
      }
      toast.success('Member removed')
      setMembers(m => m.filter(x => x.user_id !== userId))
    } catch (err: any) {
      toast.error(err.message)
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
      window.location.href = '/projects'
    } catch (err: any) {
      toast.error(err.message)
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 font-body transition-all duration-150 ${isOpen ? 'bg-bg/80' : 'bg-transparent pointer-events-none'}`}>
        <div className={`bg-bg border border-border p-8 rounded-lg shadow-[0_8px_24px_var(--shadow-color)] transition-all duration-150 ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.98] translate-y-1'}`}>
          <div className="text-text-primary font-display font-medium">Loading settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 font-body transition-all duration-150 ${isOpen ? 'bg-bg/80' : 'bg-transparent pointer-events-none'}`}
      onClick={handleClose}
    >
      <div 
        className={`bg-bg border border-border w-full max-w-[800px] max-h-[90vh] overflow-y-auto rounded-lg shadow-[0_8px_24px_var(--shadow-color)] space-y-8 p-8 transition-all duration-150 ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.98] translate-y-1'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-display font-semibold text-text-primary">Project Settings</h1>
            <p className="text-sm text-text-secondary mt-1">Manage project lifecycle and image preprocessing variables.</p>
          </div>
          <button onClick={handleClose} className="flex items-center justify-center w-8 h-8 rounded text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors duration-150 ease-out" aria-label="Close settings">
             <X size={18} />
          </button>
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
                className="w-full h-9 bg-surface-2 border border-border rounded px-3 text-sm font-body text-text-primary focus:border-accent-cyan focus:ring-2 focus:ring-[var(--focus-ring)] outline-none transition-colors duration-150"
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

          {/* Team & Access */}
          <div className="bg-surface border border-border p-6 rounded-lg space-y-4">
            <h2 className="text-lg font-display font-medium text-text-primary border-b border-border pb-2">Team & Access</h2>
            
            <form onSubmit={handleInvite} className="flex gap-2 items-end">
              <div className="flex-1 space-y-1">
                <label className="text-xs uppercase font-display font-semibold tracking-[0.03em] text-text-secondary">Invite by Email</label>
                <input 
                  type="email" 
                  required
                  placeholder="user@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm font-body text-text-primary focus:border-accent-cyan outline-none"
                />
              </div>
              <div className="w-48 space-y-1">
                <label className="text-xs uppercase font-display font-semibold tracking-[0.03em] text-text-secondary">Role</label>
                <select 
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm font-body text-text-primary focus:border-accent-cyan outline-none"
                >
                  <option value="annotator">Annotator</option>
                  <option value="reviewer">Reviewer</option>
                </select>
              </div>
              <button 
                type="submit"
                disabled={inviting}
                className="bg-accent-cyan hover:bg-accent-cyan-hover text-bg px-4 py-2 rounded-md font-display font-medium text-sm transition-colors disabled:opacity-50 h-9"
              >
                {inviting ? 'Inviting...' : 'Invite'}
              </button>
            </form>

            <div className="mt-4 border border-border rounded-md overflow-hidden bg-surface-2">
              <table className="w-full text-left text-sm font-body text-text-primary">
                <thead className="bg-surface border-b border-border text-xs uppercase font-display text-text-secondary">
                  <tr>
                    <th className="px-4 py-2 font-medium">User Email</th>
                    <th className="px-4 py-2 font-medium w-32">Role</th>
                    <th className="px-4 py-2 font-medium w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {members.map(m => (
                    <tr key={m.user_id}>
                      <td className="px-4 py-2 font-data text-xs">{m.email}</td>
                      <td className="px-4 py-2 capitalize">{m.role}</td>
                      <td className="px-4 py-2">
                        {m.role !== 'owner' && (
                          <button 
                            onClick={() => handleRemoveMember(m.user_id)}
                            className="text-accent-red hover:text-accent-red/80 font-display font-medium text-xs transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {members.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-4 text-center text-text-tertiary">Loading members...</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-display font-semibold text-text-secondary uppercase tracking-[0.03em] mb-2">Pending Invites</h3>
              <div className="border border-border rounded-md overflow-hidden bg-surface-2">
                <table className="w-full text-left text-sm font-body text-text-primary">
                  <thead className="bg-surface border-b border-border text-xs uppercase font-display text-text-secondary">
                    <tr>
                      <th className="px-4 py-2 font-medium">Email</th>
                      <th className="px-4 py-2 font-medium w-32">Role</th>
                      <th className="px-4 py-2 font-medium w-40">Sent At</th>
                      <th className="px-4 py-2 font-medium w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {invites.map(inv => (
                      <tr key={inv.id}>
                        <td className="px-4 py-2 font-data text-xs">{inv.invited_email}</td>
                        <td className="px-4 py-2 capitalize">{inv.role}</td>
                        <td className="px-4 py-2 text-xs text-text-secondary font-data">
                          {new Date(inv.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() => handleRevokeInvite(inv.id)}
                            className="text-accent-red hover:text-accent-red/80 font-display font-medium text-xs transition-colors"
                          >
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                    {invites.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-4 text-center text-text-tertiary">No pending invites.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
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
                        <span className={`text-sm font-body truncate flex-1 ${driveFolderId === folder.id ? 'font-medium' : ''}`}>{folder.name}</span>
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
                    {driveFolderId === currentFolder.id 
                      ? currentFolder.name 
                      : (folders.find(f => f.id === driveFolderId)?.name || path.find(p => p.id === driveFolderId)?.name || 'Unknown')}
                  </span>
                </div>
                <button 
                  type="button"
                  onClick={() => setDriveFolderId(currentFolder.id)}
                  disabled={driveFolderId === currentFolder.id}
                  className="px-4 py-2 bg-surface-2 border border-border rounded-md text-sm font-display font-medium text-text-primary hover:bg-surface-hover hover:border-text-tertiary disabled:opacity-50 transition-colors"
                >
                  Select Current Folder
                </button>
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
              className="h-9 flex items-center gap-2 px-5 bg-accent-cyan text-bg rounded text-sm font-display font-semibold hover:bg-accent-cyan-hover transition-colors duration-150 ease-out active:scale-[0.98] disabled:opacity-50"
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
              <div className="flex gap-3">
                <input 
                  type="text" 
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="flex-1 h-9 bg-surface-2 border border-border rounded px-3 text-sm font-body text-text-primary focus:border-accent-red focus:ring-2 focus:ring-[rgba(255,84,112,0.35)] outline-none transition-colors duration-150"
                />
                <button 
                  onClick={handleDeleteProject}
                  disabled={deleting || deleteConfirmText !== project?.name}
                  className="h-9 flex items-center gap-2 px-4 bg-transparent border border-accent-red text-accent-red rounded text-sm font-display font-semibold hover:bg-accent-red/10 transition-colors duration-150 ease-out active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
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
