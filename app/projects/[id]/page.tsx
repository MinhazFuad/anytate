'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AnnotationCanvas from '@/components/AnnotationCanvas'
import ThemeToggle from '@/components/ThemeToggle'
import { toast } from 'sonner'
import { ArrowLeft, Play } from 'lucide-react'
import { processImageClientSide } from '@/lib/imageProcessor'
import Link from 'next/link'

export default function ProjectWorkspacePage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [classes, setClasses] = useState<any[]>([])
  const [activeImage, setActiveImage] = useState<any>(null)
  const [imgSrc, setImgSrc] = useState<string>('')
  const [existingBoxes, setExistingBoxes] = useState<any[]>([])
  const [taxVersions, setTaxVersions] = useState<any[]>([])
  const [selectedTaxVersionId, setSelectedTaxVersionId] = useState<string>('')
  
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  
  const [sceneVersions, setSceneVersions] = useState<any[]>([])
  const [selectedSceneVersionId, setSelectedSceneVersionId] = useState<string>('')
  
  const [sceneFields, setSceneFields] = useState<any[]>([])
  const [sceneContext, setSceneContext] = useState<Record<string, any>>({})
  
  useEffect(() => {
    async function initWorkspace() {
      try {
        // 1. Get project
        const { data: project } = await supabase.from('projects').select('*').eq('id', id).single()
        if (!project) throw new Error('Project not found')

        // 2. Get all taxonomy versions
        const { data: taxVers } = await supabase.from('taxonomy_versions').select('id, version_number, version_name, is_active').eq('project_id', id).order('version_number', { ascending: false })
        if (taxVers) setTaxVersions(taxVers)
        
        // 3. Get all scene metadata versions
        const { data: sceneVers, error: sceneErr } = await supabase.from('scene_metadata_field_sets').select('id, version_number, version_name, is_active').eq('project_id', id).order('version_number', { ascending: false })
        
        let validSceneVers = sceneVers
        if (sceneErr) {
           // Fallback if version_name column doesn't exist yet
           const { data: fallback } = await supabase.from('scene_metadata_field_sets').select('id, version_number, is_active').eq('project_id', id).order('version_number', { ascending: false })
           validSceneVers = fallback as any
        }
        
        if (validSceneVers) setSceneVersions(validSceneVers)

        const activeTax = taxVers?.find(v => v.is_active)
        const activeScene = validSceneVers?.find(v => v.is_active)
        let initialTaxId = activeTax?.id || ''
        let initialSceneId = activeScene?.id || ''
        
        // 3. For Milestone 4 testing: just grab the first image from the Drive folder
        // In a real app we'd sync them to the 'images' table, but here we can just list Drive or sync on the fly
        // Let's call our drive list API to get the first one if we don't have images in DB yet
        
        let targetFileId = ''
        const urlParams = new URLSearchParams(window.location.search)
        const imageIdParam = urlParams.get('imageId')

        if (imageIdParam) {
          // Loading a specific, likely completed, image to edit
          const { data: specificImg } = await supabase.from('images').select('*').eq('id', imageIdParam).single()
          if (!specificImg) throw new Error('Requested image not found')
          
          setActiveImage(specificImg)
          targetFileId = specificImg.drive_file_id

          // Load its existing annotations
          const { data: ann } = await supabase.from('annotations').select('grounded_instances, scene_context, taxonomy_version_id, scene_metadata_field_set_id').eq('image_id', specificImg.id).maybeSingle()
          if (ann) {
             if (ann.grounded_instances) setExistingBoxes(ann.grounded_instances)
             if (ann.scene_context) setSceneContext(ann.scene_context)
             if (ann.taxonomy_version_id) initialTaxId = ann.taxonomy_version_id
             if (ann.scene_metadata_field_set_id) initialSceneId = ann.scene_metadata_field_set_id
          }

        } else {
          // Normal flow: get first pending image, or sync if none
          const { data: pendingImage } = await supabase.from('images').select('*').eq('project_id', id).eq('status', 'pending').eq('drive_folder_id', project.drive_image_folder_id).limit(1).maybeSingle()
          
          if (pendingImage) {
            setActiveImage(pendingImage)
            targetFileId = pendingImage.drive_file_id

            // Check for drafts
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
              const { data: draft } = await supabase.from('drafts').select('draft_state').eq('image_id', pendingImage.id).eq('user_id', user.id).maybeSingle()
              if (draft && draft.draft_state && draft.draft_state.boxes) {
                setExistingBoxes(draft.draft_state.boxes)
              }
            }

          } else {
            // Sync images: find the first file from Drive that isn't already in the DB
            const listRes = await fetch(`/api/drive/list?folderId=${project.drive_image_folder_id}`)
            const listData = await listRes.json()
            
            if (!listRes.ok || !listData.files || listData.files.length === 0) {
              throw new Error('No images found in Drive folder')
            }

            const { data: existingAll } = await supabase.from('images').select('drive_file_id').eq('project_id', id)
            const existingIds = new Set(existingAll?.map(img => img.drive_file_id) || [])
            
            const nextFile = listData.files.find((f: any) => !existingIds.has(f.id))
            
            if (!nextFile) {
              throw new Error('All images in this folder have been annotated! You are done.')
            }

            const { data: newImg, error: imgErr } = await supabase.from('images').insert({
              project_id: id as string,
              drive_file_id: nextFile.id,
              file_name: nextFile.name
            }).select().single()
            
            if (imgErr) throw imgErr
            
            setActiveImage(newImg)
            targetFileId = nextFile.id
          }
        }
        
        // Fetch initial classes
        if (initialTaxId) {
           setSelectedTaxVersionId(initialTaxId)
           const { data: classData } = await supabase.from('taxonomy_classes').select('*').eq('taxonomy_version_id', initialTaxId).order('sort_order')
           if (classData) setClasses(classData)
        }
        
        // Fetch initial scene metadata fields
        if (initialSceneId) {
           setSelectedSceneVersionId(initialSceneId)
           const { data: sFields } = await supabase.from('scene_metadata_fields').select('*').eq('field_set_id', initialSceneId).order('sort_order')
           if (sFields) setSceneFields(sFields)
        }

        // 4. Fetch the image bytes using access token
        const tokenRes = await fetch('/api/drive/refresh')
        const tokenData = await tokenRes.json()
        if (!tokenRes.ok) throw new Error(tokenData.error)
        
        const imgRes = await fetch(`https://www.googleapis.com/drive/v3/files/${targetFileId}?alt=media`, {
          headers: { Authorization: `Bearer ${tokenData.accessToken}` }
        })
        if (!imgRes.ok) throw new Error('Failed to load image bytes from Drive')
        
        const blob = await imgRes.blob()
        const preprocessed = await processImageClientSide(
          blob, 
          project.preprocessing?.max_dim || 1024, 
          project.preprocessing?.jpeg_quality || 85
        )
        setImgSrc(preprocessed.url)

        // 5. Fetch a list of completed images for the sidebar
        const { data: recentAnns } = await supabase.from('annotations')
           .select('updated_at, images!inner(id, file_name)')
           .eq('images.project_id', id)
           .eq('images.drive_folder_id', project.drive_image_folder_id)
           .order('updated_at', { ascending: false })
           .limit(20)
        setCompletedImages(recentAnns?.map(a => a.images).reverse() || [])

        // 5.5 Fetch progress
        fetch(`/api/drive/list?folderId=${project.drive_image_folder_id}`)
          .then(res => res.json())
          .then(async data => {
             if (data.files) {
                const total = data.files.length
                const { count: doneCount } = await supabase.from('images').select('*', { count: 'exact', head: true }).eq('project_id', id).eq('status', 'done').eq('drive_folder_id', project.drive_image_folder_id)
                setProgress({ done: doneCount || 0, total })
             }
          }).catch(console.error)

        // 6. Define function to keep queue filled
        const fillQueue = async (currentQueue: any[], targetFileIdToExclude: string) => {
            if (currentQueue.length >= 5) return currentQueue;
            const needed = 5 - currentQueue.length;
            
            const existingInQueue = new Set(currentQueue.map(q => q.image.id))
            existingInQueue.add(targetFileIdToExclude)

            // We need to fetch pending images that are not in queue and not the current active image
            const { data: pending } = await supabase.from('images')
                .select('*')
                .eq('project_id', id)
                .eq('status', 'pending')
                .eq('drive_folder_id', project.drive_image_folder_id)
                .limit(needed * 3) // overfetch to allow filtering

            if (!pending) return currentQueue;
            
            const toProcess = pending.filter(img => !existingInQueue.has(img.id)).slice(0, needed)
            if (toProcess.length === 0) return currentQueue;

            const { data: { user } } = await supabase.auth.getUser()
            const newItems = []

            for (const img of toProcess) {
                const bgRes = await fetch(`https://www.googleapis.com/drive/v3/files/${img.drive_file_id}?alt=media`, {
                    headers: { Authorization: `Bearer ${tokenData.accessToken}` }
                })
                if (bgRes.ok) {
                    const bgBlob = await bgRes.blob()
                    const preproc = await processImageClientSide(
                        bgBlob, 
                        project.preprocessing?.max_dim || 1024, 
                        project.preprocessing?.jpeg_quality || 85
                    )
                    let draftBoxes = []
                    let draftContext = {}
                    if (user) {
                        const { data: draft } = await supabase.from('drafts').select('draft_state').eq('image_id', img.id).eq('user_id', user.id).maybeSingle()
                        if (draft?.draft_state?.boxes) draftBoxes = draft.draft_state.boxes
                        if (draft?.draft_state?.scene_context) draftContext = draft.draft_state.scene_context
                    }
                    newItems.push({ image: img, blobUrl: preproc.url, draftBoxes, draftContext })
                }
            }
            return [...currentQueue, ...newItems]
        }

        // Attach fillQueue to window so we can call it outside initWorkspace if needed, 
        // or we just call it now and then attach to window
        (window as any).fillQueueFn = () => {
           setPreloadQueue(prev => {
              fillQueue(prev, activeImage?.drive_file_id || targetFileId).then(filled => {
                  if (filled.length > prev.length) setPreloadQueue(filled)
              })
              return prev
           })
        }

        // Background preload next 5 images (if we are in normal sequential mode)
        if (!imageIdParam) {
           setTimeout(() => {
              (window as any).fillQueueFn()
           }, 500)
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    
    initWorkspace()
  }, [id])

  const [completedImages, setCompletedImages] = useState<any[]>([])
  const [preloadQueue, setPreloadQueue] = useState<{image: any, blobUrl: string, draftBoxes: any[], draftContext: any}[]>([])

  const handleTaxonomyChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
     const newId = e.target.value
     setSelectedTaxVersionId(newId)
     const { data: classData } = await supabase.from('taxonomy_classes').select('*').eq('taxonomy_version_id', newId).order('sort_order')
     if (classData) setClasses(classData)
  }

  const handleSceneVersionChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
     const newId = e.target.value
     setSelectedSceneVersionId(newId)
     const { data: sFields } = await supabase.from('scene_metadata_fields').select('*').eq('field_set_id', newId).order('sort_order')
     if (sFields) {
       setSceneFields(sFields)
       // clear non-persisted context that doesn't exist in new schema? for now we just leave it, it's fine
     }
  }

  const getNextContext = (draftContext: any) => {
     if (Object.keys(draftContext || {}).length > 0) return draftContext;
     // Persist current sceneContext fields that are configured to persist
     const nextCtx: Record<string, any> = {};
     sceneFields.forEach(f => {
       const shouldPersist = sceneContext[`_persist_${f.field_key}`] !== undefined 
          ? sceneContext[`_persist_${f.field_key}`] 
          : f.persists_across_images;
          
       if (shouldPersist && sceneContext[f.field_key] !== undefined) {
         nextCtx[f.field_key] = sceneContext[f.field_key];
         nextCtx[`_persist_${f.field_key}`] = shouldPersist;
       }
     })
     return nextCtx;
  }

  const handleSave = async (boxes: any[]) => {
    try {
      setLoading(true)
      
      const cleanSceneContext = { ...sceneContext }
      Object.keys(cleanSceneContext).forEach(k => {
        if (k.startsWith('_persist_')) delete cleanSceneContext[k]
      })

      const payload = {
        image_id: activeImage.id,
        project_id: id,
        taxonomy_version_id: selectedTaxVersionId || undefined,
        scene_metadata_field_set_id: selectedSceneVersionId || undefined,
        boxes: boxes.map(b => ({
          class_key: b.class_key,
          ymin: b.bbox[0],
          xmin: b.bbox[1],
          ymax: b.bbox[2],
          xmax: b.bbox[3],
          fcot: b.fcot
        })),
        scene_context: cleanSceneContext
      }
      
      const res = await fetch('/api/annotations/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Validation failed')
      }
      
      // Remove query param if we were editing, then reload to get next pending
      if (window.location.search) {
         window.location.href = `/projects/${id}`
      } else {
         if (preloadQueue.length > 0) {
            const next = preloadQueue[0]
            setPreloadQueue(q => q.slice(1))
            setActiveImage(next.image)
            setImgSrc(next.blobUrl)
            setExistingBoxes(next.draftBoxes)
            setSceneContext(getNextContext(next.draftContext))
            setLoading(false)
            
            // Refetch done images for sidebar
            const { data: recentAnns } = await supabase.from('annotations')
               .select('updated_at, images!inner(id, file_name)')
               .eq('images.project_id', id)
               .order('updated_at', { ascending: false })
               .limit(20)
            setCompletedImages(recentAnns?.map(a => a.images).reverse() || [])
            
            setProgress(p => ({ ...p, done: p.done + 1 }))
            
            // Replenish the queue!
            if ((window as any).fillQueueFn) {
               (window as any).fillQueueFn()
            }
         } else {
            window.location.reload()
         }
      }
      
    } catch (err: any) {
      toast.error("Error saving: " + err.message)
      setLoading(false)
    }
  }

  const handleSkip = () => {
    if (window.location.search) {
       window.location.href = `/projects/${id}`
    } else {
       if (preloadQueue.length > 0) {
          const next = preloadQueue[0]
          setPreloadQueue(q => q.slice(1))
          setActiveImage(next.image)
          setImgSrc(next.blobUrl)
          setExistingBoxes(next.draftBoxes)
          setSceneContext(getNextContext(next.draftContext))
          setLoading(false)
          
          // Replenish the queue!
          if ((window as any).fillQueueFn) {
             (window as any).fillQueueFn()
          }
       } else {
          window.location.reload()
       }
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background text-text">Loading workspace...</div>
  if (error) return <div className="min-h-screen flex items-center justify-center bg-background text-warn">{error}</div>

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text-primary relative font-body">
      
      <div className="w-72 border-r border-border bg-surface flex flex-col z-10 relative shrink-0">
         <div className="p-6 border-b border-border flex flex-col gap-3">
           <div className="flex items-center justify-between">
             <div className="text-xl font-display font-semibold text-text-primary">Workspace</div>
             <ThemeToggle />
           </div>
           
           <div className="flex flex-col gap-1">
             <label className="text-[10px] uppercase font-display font-medium tracking-[0.03em] text-text-secondary">Taxonomy Version</label>
             <select 
               value={selectedTaxVersionId} 
               onChange={handleTaxonomyChange}
               className="bg-surface-2 border border-border rounded-md px-2 py-1 text-xs font-display text-text-primary focus:border-accent-cyan outline-none"
             >
               {taxVersions.map(v => (
                 <option key={v.id} value={v.id}>
                   v{v.version_number} {v.version_name ? `- ${v.version_name}` : ''} {v.is_active ? '(Active)' : ''}
                 </option>
               ))}
             </select>
           </div>

           <Link href={`/projects/${id}/dashboard`} className="mt-1 text-xs font-display font-medium text-text-secondary hover:text-text-primary transition-all duration-150 ease-out flex items-center gap-1.5">
              <ArrowLeft size={16} strokeWidth={1.5} /> Back to Dashboard
           </Link>
         </div>
         <div className="p-6 flex-1 overflow-y-auto">
           <div className="mb-4 text-[11px] font-display uppercase tracking-[0.03em] text-text-secondary flex items-center justify-between">
              <span>Completed</span>
              <span className="bg-surface-2 border border-border px-2 py-0.5 rounded-full text-text-primary font-data">{completedImages.length}</span>
           </div>
           <div className="flex flex-col gap-2">
              {completedImages.map(img => (
               <Link 
                 key={img.id} 
                 href={`/projects/${id}?imageId=${img.id}`}
                 className={`text-sm px-3 py-2.5 rounded-md font-data truncate border transition-all duration-150 ${activeImage.id === img.id ? 'bg-accent-cyan-muted border-accent-cyan text-accent-cyan' : 'bg-surface hover:bg-surface-hover border-transparent hover:border-border text-text-secondary hover:text-text-primary'}`}
               >
                 {img.file_name}
               </Link>
             ))}
           </div>
           
           <Link href={`/projects/${id}`} className="mt-8 flex items-center justify-center gap-2 w-full py-3 bg-accent-cyan text-bg font-display font-medium rounded-md hover:bg-accent-cyan-hover transition-all duration-150 ease-out">
             <Play size={16} strokeWidth={1.5} fill="currentColor" /> Start Next Pending
           </Link>
         </div>
      </div>
      
      <div className="flex-1 relative z-10 bg-bg flex flex-col min-w-0">
        <div className="h-14 border-b border-border flex items-center px-6 shrink-0 justify-between">
           <div className="flex flex-col gap-0.5">
             <span className="text-sm font-data text-text-primary truncate max-w-md">{activeImage?.file_name}</span>
           </div>
           
           {progress.total > 0 && (
             <div className="flex flex-col gap-1.5 items-end w-48">
               <div className="flex justify-between w-full text-[10px] uppercase font-display font-medium tracking-[0.03em] text-text-secondary">
                 <span>Progress</span>
                 <span>{progress.done} / {progress.total}</span>
               </div>
               <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
                 <div 
                   className="h-full bg-accent-cyan transition-all duration-500 ease-out"
                   style={{ width: `${Math.min(100, Math.max(0, (progress.done / progress.total) * 100))}%` }}
                 />
               </div>
             </div>
           )}
        </div>
        
        <div className="flex-1 relative flex items-center justify-center min-h-0">
          <AnnotationCanvas 
            imgSrc={imgSrc} 
            classes={classes} 
            initialBoxes={existingBoxes}
            onSave={handleSave} 
            onSkip={handleSkip}
            imageId={activeImage.id}
          />
        </div>
      </div>

      {(sceneFields.length > 0 || sceneVersions.length > 0) && (
         <div className="w-80 border-l border-border bg-surface flex flex-col z-10 relative shrink-0 overflow-y-auto">
            <div className="p-6 border-b border-border flex flex-col gap-3 sticky top-0 bg-surface z-20">
               <div className="flex items-center justify-between">
                 <div className="text-sm font-display font-semibold text-text-primary">Scene Metadata</div>
               </div>
               
               <div className="flex flex-col gap-1">
                 <label className="text-[10px] uppercase font-display font-medium tracking-[0.03em] text-text-secondary">Schema Version</label>
                 <select 
                   value={selectedSceneVersionId} 
                   onChange={handleSceneVersionChange}
                   className="bg-surface-2 border border-border rounded-md px-2 py-1 text-xs font-display text-text-primary focus:border-accent-cyan outline-none"
                 >
                   {sceneVersions.map(v => (
                     <option key={v.id} value={v.id}>
                       v{v.version_number} {v.version_name ? `- ${v.version_name}` : ''} {v.is_active ? '(Active)' : ''}
                     </option>
                   ))}
                 </select>
               </div>
            </div>
            
            <div className="p-6 flex flex-col gap-6">
               {sceneFields.map(f => (
                 <div key={f.field_key} className="flex flex-col gap-2">
                    <label className="text-xs font-display font-medium text-text-primary uppercase tracking-[0.03em] flex items-center justify-between">
                       {f.label}
                       <label className="flex items-center gap-1.5 cursor-pointer" title="Persist this value across next images">
                          <input 
                             type="checkbox" 
                             checked={sceneContext[`_persist_${f.field_key}`] !== undefined ? sceneContext[`_persist_${f.field_key}`] : f.persists_across_images}
                             onChange={(e) => setSceneContext(prev => ({...prev, [`_persist_${f.field_key}`]: e.target.checked}))}
                             className="w-3 h-3 accent-accent-cyan cursor-pointer"
                          />
                          <span className="text-[10px] text-text-tertiary normal-case font-body tracking-normal">Persist</span>
                       </label>
                    </label>
                    
                    {f.field_type === 'text' && (
                       <input 
                          type="text" 
                          value={sceneContext[f.field_key] || ''}
                          onChange={(e) => setSceneContext(prev => ({...prev, [f.field_key]: e.target.value}))}
                          className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm font-body text-text-primary focus:border-accent-cyan focus:outline-none focus:ring-2 focus:ring-focus-ring"
                       />
                    )}
                    {f.field_type === 'number' && (
                       <input 
                          type="number" 
                          value={sceneContext[f.field_key] || ''}
                          onChange={(e) => setSceneContext(prev => ({...prev, [f.field_key]: Number(e.target.value)}))}
                          className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm font-data text-text-primary focus:border-accent-cyan focus:outline-none focus:ring-2 focus:ring-focus-ring"
                       />
                    )}
                    {f.field_type === 'textarea' && (
                       <textarea 
                          value={sceneContext[f.field_key] || ''}
                          onChange={(e) => setSceneContext(prev => ({...prev, [f.field_key]: e.target.value}))}
                          className="w-full h-24 bg-surface-2 border border-border rounded-md px-3 py-2 text-sm font-body text-text-primary focus:border-accent-cyan focus:outline-none focus:ring-2 focus:ring-focus-ring"
                       />
                    )}
                    {f.field_type === 'select' && (
                       <select 
                          value={sceneContext[f.field_key] || ''}
                          onChange={(e) => setSceneContext(prev => ({...prev, [f.field_key]: e.target.value}))}
                          className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm font-body text-text-primary focus:border-accent-cyan focus:outline-none focus:ring-2 focus:ring-focus-ring"
                       >
                          <option value="" disabled className="text-text-tertiary">Select an option...</option>
                          {f.options?.map((opt: any, idx: number) => {
                             const val = typeof opt === 'string' ? opt : (opt.value || opt.label || JSON.stringify(opt));
                             const display = typeof opt === 'string' ? opt : (opt.label || opt.value || val);
                             return <option key={`${val}-${idx}`} value={val}>{display}</option>
                          })}
                       </select>
                    )}
                    {f.field_type === 'slider' && (
                       <div className="flex items-center gap-3">
                          <input 
                             type="range" 
                             min={f.options?.min || 0} 
                             max={f.options?.max || 10} 
                             step={f.options?.step || 1}
                             value={sceneContext[f.field_key] || f.options?.min || 0}
                             onChange={(e) => setSceneContext(prev => ({...prev, [f.field_key]: Number(e.target.value)}))}
                             className="flex-1 accent-accent-cyan"
                          />
                          <span className="text-sm font-data text-accent-cyan bg-accent-cyan-muted px-2 py-0.5 rounded-sm">
                             {sceneContext[f.field_key] || f.options?.min || 0}
                          </span>
                       </div>
                    )}
                 </div>
               ))}
            </div>
         </div>
       )}
    </div>
  )
}
