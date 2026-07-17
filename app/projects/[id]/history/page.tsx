'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'

export default function ProvenanceHistoryPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [taxVersions, setTaxVersions] = useState<any[]>([])
  const [sceneVersions, setSceneVersions] = useState<any[]>([])

  useEffect(() => {
    async function loadHistory() {
      // Fetch taxonomy versions and their associated annotations + image filenames
      const { data: tData } = await supabase
        .from('taxonomy_versions')
        .select(`
          id, 
          version_number, 
          version_name,
          is_active, 
          created_at,
          annotations (
            images (
              id,
              file_name
            )
          )
        `)
        .eq('project_id', id)
        .order('version_number', { ascending: false })
        
      if (tData) setTaxVersions(tData)

      // Fetch scene metadata versions
      const { data: sData, error: sErr } = await supabase
        .from('scene_metadata_field_sets')
        .select(`
          id, 
          version_number, 
          version_name,
          is_active, 
          created_at,
          annotations (
            images (
              id,
              file_name
            )
          )
        `)
        .eq('project_id', id)
        .order('version_number', { ascending: false })
        
      let validSData = sData
      if (sErr) {
         const { data: fallback } = await supabase
            .from('scene_metadata_field_sets')
            .select(`
              id, 
              version_number, 
              is_active, 
              created_at,
              annotations (
                images (
                  id,
                  file_name
                )
              )
            `)
            .eq('project_id', id)
            .order('version_number', { ascending: false })
         validSData = fallback as any
      }
        
      if (validSData) setSceneVersions(validSData)
      
      setLoading(false)
    }
    loadHistory()
  }, [id, supabase])

  const handleAction = async (action: 'set_active' | 'delete' | 'rename', versionId: string, schemaType: 'taxonomy' | 'scene_metadata', newName?: string) => {
    if (action === 'delete') {
      if (!confirm('Are you sure you want to delete this version? This cannot be undone.')) return
    } else if (action === 'set_active') {
      if (!confirm('Are you sure you want to set this version as active? All new annotations will use this schema.')) return
    }

    try {
      setLoading(true)
      const res = await fetch('/api/schema/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, versionId, projectId: id, schemaType, newName })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      // Reload history
      toast.success('Action successful')
      window.location.reload()
    } catch(e: any) {
      toast.error(e.message)
      setLoading(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-bg flex items-center justify-center text-text-primary">Loading history...</div>

  return (
    <div className="min-h-screen bg-bg text-text-primary p-8 font-body">
      <div className="max-w-[1280px] mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
           <Link href={`/projects/${id}/dashboard`} className="text-text-secondary hover:text-text-primary text-sm font-display font-medium transition-all duration-150 ease-out flex items-center gap-2 w-fit">
              <ArrowLeft size={18} strokeWidth={1.5} /> Back to Dashboard
           </Link>
           <ThemeToggle />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-semibold text-text-primary">Data Provenance History</h1>
            <p className="text-sm text-text-secondary mt-1">Track which images were annotated under which FCOT schema version.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* Taxonomy Column */}
          <div className="space-y-6">
            <h2 className="text-xl font-display font-medium text-text-primary border-b border-border pb-2">Taxonomy History</h2>
            {taxVersions.map((v) => {
              const annotatedImages = v.annotations?.map((a: any) => a.images) || []
              return (
                <div key={v.id} className={`p-6 rounded-lg border ${v.is_active ? 'border-accent-cyan bg-accent-cyan-muted' : 'border-border bg-surface'}`}>
                  <div className="flex items-center justify-between mb-4 border-b border-border pb-4">
                    <div className="flex items-center gap-4">
                      <input
                        type="text"
                        defaultValue={v.version_name || `Version ${v.version_number}`}
                        onBlur={(e) => {
                           const newName = e.target.value.trim()
                           if (newName !== (v.version_name || `Version ${v.version_number}`)) {
                              handleAction('rename', v.id, 'taxonomy', newName)
                           }
                        }}
                        className={`text-xl font-display font-medium bg-transparent border-b border-transparent hover:border-border focus:border-accent-cyan outline-none w-48 transition-colors ${v.is_active ? 'text-accent-cyan' : 'text-text-primary'}`}
                        placeholder={`Version ${v.version_number}`}
                      />
                      {v.is_active ? (
                        <span className="px-2 py-0.5 text-[10px] font-display font-semibold uppercase tracking-[0.03em] bg-accent-cyan text-bg rounded-full">
                          Active Schema
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                           <button 
                             onClick={() => handleAction('set_active', v.id, 'taxonomy')}
                             className="px-3 py-1.5 text-[11px] font-display font-medium uppercase tracking-[0.03em] border border-border text-text-primary rounded-full hover:bg-surface-hover hover:border-accent-cyan transition-colors"
                           >
                             Set Active
                           </button>
                           {annotatedImages.length === 0 && (
                             <button 
                               onClick={() => handleAction('delete', v.id, 'taxonomy')}
                               className="px-3 py-1.5 text-[11px] font-display font-medium uppercase tracking-[0.03em] border border-accent-red/50 text-accent-red rounded-full hover:bg-accent-red/10 transition-colors"
                             >
                               Delete
                             </button>
                           )}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-text-secondary font-data">{new Date(v.created_at).toLocaleString()}</div>
                      <div className="font-medium font-data text-base text-text-primary mt-1">{annotatedImages.length} Images</div>
                    </div>
                  </div>

                  {annotatedImages.length > 0 ? (
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-4 max-h-96 overflow-y-auto pr-2">
                      {annotatedImages.map((img: any) => (
                        <Link 
                          key={img.id}
                          href={`/projects/${id}?imageId=${img.id}`}
                          className="p-3 bg-surface-2 border border-border rounded-md text-sm font-data text-text-secondary hover:text-text-primary hover:border-border-strong hover:bg-surface-hover transition-colors truncate focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring"
                          title={img.file_name}
                        >
                          {img.file_name}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-text-tertiary text-sm italic mt-4 font-body">
                      No images were annotated under this version.
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Scene Metadata Column */}
          <div className="space-y-6">
            <h2 className="text-xl font-display font-medium text-text-primary border-b border-border pb-2">Scene Metadata History</h2>
            {sceneVersions.map((v) => {
              const annotatedImages = v.annotations?.map((a: any) => a.images) || []
              return (
                <div key={v.id} className={`p-6 rounded-lg border ${v.is_active ? 'border-accent-cyan bg-accent-cyan-muted' : 'border-border bg-surface'}`}>
                  <div className="flex items-center justify-between mb-4 border-b border-border pb-4">
                    <div className="flex items-center gap-4">
                      <input
                        type="text"
                        defaultValue={v.version_name || `Version ${v.version_number}`}
                        onBlur={(e) => {
                           const newName = e.target.value.trim()
                           if (newName !== (v.version_name || `Version ${v.version_number}`)) {
                              handleAction('rename', v.id, 'scene_metadata', newName)
                           }
                        }}
                        className={`text-xl font-display font-medium bg-transparent border-b border-transparent hover:border-border focus:border-accent-cyan outline-none w-48 transition-colors ${v.is_active ? 'text-accent-cyan' : 'text-text-primary'}`}
                        placeholder={`Version ${v.version_number}`}
                      />
                      {v.is_active ? (
                        <span className="px-2 py-0.5 text-[10px] font-display font-semibold uppercase tracking-[0.03em] bg-accent-cyan text-bg rounded-full">
                          Active Schema
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                           <button 
                             onClick={() => handleAction('set_active', v.id, 'scene_metadata')}
                             className="px-3 py-1.5 text-[11px] font-display font-medium uppercase tracking-[0.03em] border border-border text-text-primary rounded-full hover:bg-surface-hover hover:border-accent-cyan transition-colors"
                           >
                             Set Active
                           </button>
                           {annotatedImages.length === 0 && (
                             <button 
                               onClick={() => handleAction('delete', v.id, 'scene_metadata')}
                               className="px-3 py-1.5 text-[11px] font-display font-medium uppercase tracking-[0.03em] border border-accent-red/50 text-accent-red rounded-full hover:bg-accent-red/10 transition-colors"
                             >
                               Delete
                             </button>
                           )}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-text-secondary font-data">{new Date(v.created_at).toLocaleString()}</div>
                      <div className="font-medium font-data text-base text-text-primary mt-1">{annotatedImages.length} Images</div>
                    </div>
                  </div>

                  {annotatedImages.length > 0 ? (
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-4 max-h-96 overflow-y-auto pr-2">
                      {annotatedImages.map((img: any) => (
                        <Link 
                          key={img.id}
                          href={`/projects/${id}?imageId=${img.id}`}
                          className="p-3 bg-surface-2 border border-border rounded-md text-sm font-data text-text-secondary hover:text-text-primary hover:border-border-strong hover:bg-surface-hover transition-colors truncate focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring"
                          title={img.file_name}
                        >
                          {img.file_name}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-text-tertiary text-sm italic mt-4 font-body">
                      No images were annotated under this version.
                    </div>
                  )}
                </div>
              )
            })}
          </div>

        </div>

      </div>
    </div>
  )
}
