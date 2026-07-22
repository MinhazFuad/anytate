'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AnnotationCanvas from '@/components/AnnotationCanvas'
import ThemeToggle from '@/components/ThemeToggle'
import { toast } from 'sonner'
import { ArrowLeft, Play, Loader2, Search, AlertCircle, Sparkles } from 'lucide-react'
import { processImageClientSide } from '@/lib/imageProcessor'
import Link from 'next/link'

export default function ProjectWorkspacePage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [loadingMessage, setLoadingMessage] = useState('Initializing Workspace...')
  const [error, setError] = useState('')
  const [project, setProject] = useState<any>(null)
  const [classes, setClasses] = useState<any[]>([])
  const [activeImage, setActiveImageState] = useState<any>(null)
  const activeImageRef = useRef<any>(null)
  const setActiveImage = (img: any | ((prev: any) => any)) => {
    setActiveImageState((prev: any) => {
      const next = typeof img === 'function' ? img(prev) : img
      activeImageRef.current = next
      return next
    })
  }
  const [imgSrc, setImgSrc] = useState<string>('')
  const [existingBoxes, setExistingBoxes] = useState<any[]>([])
  const [taxVersions, setTaxVersions] = useState<any[]>([])
  const [selectedTaxVersionId, setSelectedTaxVersionId] = useState<string>('')
  
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  
  const [sceneVersions, setSceneVersions] = useState<any[]>([])
  const [selectedSceneVersionId, setSelectedSceneVersionId] = useState<string>('')
  
  const [sceneFields, setSceneFields] = useState<any[]>([])
  const [sceneContext, setSceneContext] = useState<Record<string, any>>({})
  const [sessionStart] = useState<number>(() => Date.now())
  const [sessionDone, setSessionDone] = useState(0)
  const [elapsedHours, setElapsedHours] = useState(1/60)
  const [imageSearch, setImageSearch] = useState('')
  const [imageSearchError, setImageSearchError] = useState('')
  const [imageSearchLoading, setImageSearchLoading] = useState(false)
  
  // Live session elapsed time ticker — updates every 30s so imagesPerHour stays fresh
  useEffect(() => {
    const tick = setInterval(() => {
      setElapsedHours(Math.max((Date.now() - sessionStart) / 3600000, 1/60))
    }, 30000)
    return () => clearInterval(tick)
  }, [sessionStart])

  useEffect(() => {
    async function initWorkspace() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        const { data: member } = await supabase.from('project_members').select('role').eq('project_id', id).eq('user_id', user.id).single()
        if (!member) throw new Error('You are not a member of this project.')
        if (member.role === 'reviewer') {
          router.replace(`/projects/${id}/review`)
          return
        }

        // 1. Get project
        const { data: project } = await supabase.from('projects').select('*').eq('id', id).single()
        if (!project) throw new Error('Project not found')
        setProject(project)

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
        
        let targetImageId = ''
        let targetFileId = ''
        const urlParams = new URLSearchParams(window.location.search)
        const imageIdParam = urlParams.get('imageId')

        if (imageIdParam) {
          // Loading a specific, likely completed, image to edit
          const { data: specificImg } = await supabase.from('images').select('*').eq('id', imageIdParam).single()
          if (!specificImg) throw new Error('Requested image not found')
          
          setActiveImage(specificImg)
          targetImageId = specificImg.id
          targetFileId = specificImg.drive_file_id

          // Load its existing annotations
          const { data: ann } = await supabase.from('annotations').select('grounded_instances, scene_context, taxonomy_version_id, scene_metadata_field_set_id, status, review_notes').eq('image_id', specificImg.id).maybeSingle()
          if (ann) {
             if (ann.grounded_instances) setExistingBoxes(ann.grounded_instances)
             if (ann.scene_context) setSceneContext(ann.scene_context)
             if (ann.taxonomy_version_id) initialTaxId = ann.taxonomy_version_id
             if (ann.scene_metadata_field_set_id) initialSceneId = ann.scene_metadata_field_set_id
             if (ann.status === 'flagged') setFlagReason(ann.review_notes || 'No notes provided by reviewer.')
             else setFlagReason(null)
          } else {
             // In case of a failed optimistic save, load their drafts!
             const { data: { user } } = await supabase.auth.getUser()
             if (user) {
                const { data: draft } = await supabase.from('drafts').select('draft_state').eq('image_id', specificImg.id).eq('user_id', user.id).maybeSingle()
                if (draft?.draft_state?.boxes) setExistingBoxes(draft.draft_state.boxes)
                if (draft?.draft_state?.scene_context) setSceneContext(draft.draft_state.scene_context)
             }
             setFlagReason(null)
          }

        } else {
          // Normal flow: get first pending image, or sync if none
          const { data: pendingImage } = await supabase.from('images').select('*').eq('project_id', id).eq('status', 'pending').eq('drive_folder_id', project.drive_image_folder_id).limit(1).maybeSingle()
          
          if (pendingImage) {
            setActiveImage(pendingImage)
            targetImageId = pendingImage.id
            targetFileId = pendingImage.drive_file_id

            // Check for drafts
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
              const { data: draft } = await supabase.from('drafts').select('draft_state').eq('image_id', pendingImage.id).eq('user_id', user.id).maybeSingle()
              if (draft && draft.draft_state && draft.draft_state.boxes) {
                setExistingBoxes(draft.draft_state.boxes)
              }
            }
            setFlagReason(null)

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
              file_name: nextFile.name,
              width: nextFile.imageMediaMetadata?.width ? parseInt(nextFile.imageMediaMetadata.width) : null,
              height: nextFile.imageMediaMetadata?.height ? parseInt(nextFile.imageMediaMetadata.height) : null
            }).select().single()
            
            if (imgErr) throw imgErr
            
            setActiveImage(newImg)
            targetImageId = newImg.id
            targetFileId = nextFile.id
            setFlagReason(null)
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

        // 5. No longer fetching completedImages list — replaced by session stats panel

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
        const fillQueue = async (currentQueue: any[], targetImageIdToExclude: string) => {
            if (currentQueue.length >= 5) return currentQueue;
            const needed = 5 - currentQueue.length;
            
            const existingInQueue = new Set(currentQueue.map(q => q.image.id))
            existingInQueue.add(targetImageIdToExclude)

            // We need to fetch pending images that are not in queue and not the current active image
            const { data: pending } = await supabase.from('images')
                .select('*')
                .eq('project_id', id)
                .eq('status', 'pending')
                .eq('drive_folder_id', project.drive_image_folder_id)
                .limit(needed * 3) // overfetch to allow filtering

            if (!pending) return currentQueue;
            
            // Exclude images we just optimistically saved in this session
            const recentlyAnnotatedSet = new Set(JSON.parse(sessionStorage.getItem(`recent_${id}`) || '[]'))

            const toProcess = pending.filter(img => !existingInQueue.has(img.id) && !recentlyAnnotatedSet.has(img.id)).slice(0, needed)
            if (toProcess.length === 0) return currentQueue;

            const { data: { user } } = await supabase.auth.getUser()
            const newItems = await Promise.all(toProcess.map(async (img) => {
                try {
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
                        return { image: img, blobUrl: preproc.url, draftBoxes, draftContext }
                    }
                } catch(e) { console.error(e) }
                return null
            }))
            
            return [...currentQueue, ...newItems.filter(Boolean)]
        }

        (window as any).fetchNextBatch = async (excludeId: string) => {
             return await fillQueue([], excludeId)
        }

        // Attach fillQueue to window so we can call it outside initWorkspace if needed, 
        // or we just call it now and then attach to window
        (window as any).fillQueueFn = () => {
           setPreloadQueue(prev => {
              fillQueue(prev, activeImageRef.current?.id || targetImageId).then(filled => {
                  if (filled.length > prev.length) setPreloadQueue(filled)
              })
              return prev
           })
        }

        // Background preload next 5 images IMMEDIATELY, even if editing
        (window as any).fillQueueFn()
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    
    initWorkspace()
  }, [id])

  const [completedImages, setCompletedImages] = useState<any[]>([]) // kept for potential future use
  const [recentlyAnnotated, setRecentlyAnnotated] = useState<string[]>([])
  const [preloadQueue, setPreloadQueue] = useState<{image: any, blobUrl: string, draftBoxes: any[], draftContext: any}[]>([])
  const [flagReason, setFlagReason] = useState<string | null>(null)
  const [failedSaves, setFailedSaves] = useState<Set<string>>(new Set())

  const imagesPerHour = sessionDone > 0 ? Math.round(sessionDone / elapsedHours) : 0

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

  const advanceToNext = async () => {
     if (preloadQueue.length > 0) {
        const next = preloadQueue[0]
        setPreloadQueue(q => q.slice(1))
        setActiveImage(next.image)
        setImgSrc(next.blobUrl)
        setExistingBoxes(next.draftBoxes)
        setSceneContext(getNextContext(next.draftContext))
        setFlagReason(null)
        if ((window as any).fillQueueFn) (window as any).fillQueueFn()
     } else {
        setLoadingMessage('Fetching next image...')
        setLoading(true)
        if ((window as any).fetchNextBatch) {
           try {
               const nextItems = await (window as any).fetchNextBatch(activeImage?.id || '')
               if (nextItems && nextItems.length > 0) {
                  const next = nextItems[0]
                  setPreloadQueue(nextItems.slice(1))
                  setActiveImage(next.image)
                  setImgSrc(next.blobUrl)
                  setExistingBoxes(next.draftBoxes)
                  setSceneContext(getNextContext(next.draftContext))
                  setFlagReason(null)
                  setLoading(false)
                  if ((window as any).fillQueueFn) (window as any).fillQueueFn()
               } else {
                  toast.success("No more pending images!")
                  window.location.href = `/projects/${id}/dashboard`
               }
           } catch(err) {
               window.location.reload()
           }
        } else {
           window.location.reload()
        }
     }
  }

  const handleSave = async (boxes: any[]) => {
    try {
      const currentActiveImage = activeImage
      
      const cleanSceneContext = { ...sceneContext }
      Object.keys(cleanSceneContext).forEach(k => {
        if (k.startsWith('_persist_')) delete cleanSceneContext[k]
      })

      const payload = {
        image_id: currentActiveImage.id,
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
      
      const wasAlreadyDone = currentActiveImage.status === 'done'
      
      // OPTIMISTIC UPDATE
      setCompletedImages(prev => {
        const filtered = prev.filter((img: any) => img.id !== currentActiveImage.id)
        return [{...currentActiveImage, status: 'done'}, ...filtered].slice(0, 20)
      })
      if (!wasAlreadyDone) {
          setProgress(p => ({ ...p, done: p.done + 1 }))
          setSessionDone(s => s + 1)
      }
      
      // Track recently annotated (session-only, last 4, most recent first)
      setRecentlyAnnotated(prev => {
        const filtered = prev.filter(n => n !== currentActiveImage.file_name)
        return [currentActiveImage.file_name, ...filtered].slice(0, 4)
      })
      
      const recentSessionIds = JSON.parse(sessionStorage.getItem(`recent_${id}`) || '[]')
      sessionStorage.setItem(`recent_${id}`, JSON.stringify([...recentSessionIds, currentActiveImage.id]))
      
      setFailedSaves(prev => {
          const next = new Set(prev)
          next.delete(currentActiveImage.id)
          return next
      })
      
      // Update active image optimistic status so unannotate works without reload
      setActiveImage((prev: any) => prev ? {...prev, status: 'done'} : prev)
      
      // AWAIT SAVE TO PREVENT SILENT FAILURE BEFORE NAVIGATION
      try {
        const res = await fetch('/api/annotations/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        if (!res.ok) {
            const errorData = await res.json()
            throw new Error(errorData.error || 'Validation failed')
        }
        
        if (window.location.search) {
           window.location.href = `/projects/${id}`
        } else {
           await advanceToNext()
        }
      } catch (err: any) {
          toast.error(`Failed to save ${currentActiveImage.file_name}: ` + err.message)
          setFailedSaves(prev => new Set(prev).add(currentActiveImage.id))
          // Revert optimistic counts
          if (!wasAlreadyDone) {
              setProgress(p => ({ ...p, done: Math.max(0, p.done - 1) }))
              setSessionDone(s => Math.max(0, s - 1))
          }
          setActiveImage((prev: any) => prev ? {...prev, status: currentActiveImage.status} : prev)
      }
      
    } catch (err: any) {
      toast.error("Error preparing save: " + err.message)
    }
  }

  const handleSkip = async () => {
    if (window.location.search) {
       setLoadingMessage('Fetching next image...')
       setLoading(true)
       window.location.href = `/projects/${id}`
    } else {
       await advanceToNext()
    }
  }

  const handleUndo = (action: string, data: any) => {
    // Unannotate: decrement counts if the image was previously done
    if (action === 'deleted' || action === 'unannotated') {
      if (activeImageRef.current?.status === 'done') {
        setProgress(p => ({ ...p, done: Math.max(0, p.done - 1) }))
        setSessionDone(s => Math.max(0, s - 1))
      }
      
      // Remove from recently annotated
      setRecentlyAnnotated(prev => prev.filter(n => n !== activeImageRef.current?.file_name))
      
      // Reset state locally instead of hard reload
      setActiveImage((prev: any) => prev ? {...prev, status: 'pending'} : prev)
      setExistingBoxes([])
      setSceneContext({})
      setFlagReason(null)
    }
  }

  const handleJumpToImage = async () => {
    const query = imageSearch.trim()
    if (!query) return
    setImageSearchLoading(true)
    setImageSearchError('')
    try {
      const { data: img } = await supabase
        .from('images')
        .select('id, file_name, status')
        .eq('project_id', id)
        .ilike('file_name', `%${query}%`)
        .limit(1)
        .maybeSingle()
      if (!img) {
        setImageSearchError('No image found matching that name.')
        setImageSearchLoading(false)
        return
      }
      window.location.href = `/projects/${id}?imageId=${img.id}`
    } catch(e: any) {
      setImageSearchError('Search failed.')
      setImageSearchLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center font-body animate-in fade-in duration-500">
        <Loader2 className="h-8 w-8 animate-spin text-accent-cyan mb-4" />
        <div className="text-text-primary font-display font-medium text-lg">{loadingMessage}</div>
        <div className="text-text-secondary text-sm mt-2 max-w-[300px] text-center">
          Fetching next image and annotations...
        </div>
      </div>
    )
  }
  if (error) return <div className="min-h-screen flex items-center justify-center bg-background text-warn">{error}</div>

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text-primary relative font-body">
      
      <div className="w-72 border-r border-border bg-surface flex flex-col z-10 relative shrink-0">
         <div className="p-5 border-b border-border flex flex-col gap-3">
           <div className="flex items-center justify-between">
             <div className="flex items-center gap-2">
               <span className="text-base font-display font-semibold text-text-primary">Workspace</span>
               {project?.solo_mode && (
                 <span className="text-[10px] px-2 py-0.5 bg-accent-green/10 border border-accent-green/30 text-accent-green rounded font-display uppercase tracking-widest font-semibold flex items-center gap-1" title="Solo Mode: Auto-approves annotations upon save">
                   <Sparkles size={10} /> Solo
                 </span>
               )}
             </div>
             <ThemeToggle />
           </div>
           <Link href={`/projects/${id}/dashboard`} className="text-xs font-display font-medium text-text-secondary hover:text-text-primary transition-all duration-150 ease-out flex items-center gap-1.5">
              <ArrowLeft size={14} strokeWidth={1.5} /> Back to Dashboard
           </Link>
         </div>

         {/* Schema selector — first after header */}
         <div className="p-5 border-b border-border flex flex-col gap-2">
           <div className="text-[10px] uppercase font-display font-medium tracking-[0.05em] text-text-secondary">Schema</div>
           <div className="flex flex-col gap-1">
             <label className="text-[10px] font-display text-text-tertiary">Classes & CoTs</label>
             <select
               value={selectedTaxVersionId}
               onChange={handleTaxonomyChange}
               className="bg-surface-2 border border-border rounded px-2 py-1.5 text-xs font-display text-text-primary focus:border-accent-cyan outline-none"
             >
               {taxVersions.map(v => (
                 <option key={v.id} value={v.id}>
                   v{v.version_number} {v.version_name ? `- ${v.version_name}` : ''} {v.is_active ? '(Active)' : ''}
                 </option>
               ))}
             </select>
           </div>
         </div>

         {/* Session Stats — compact inline strip */}
         <div className="px-5 py-3 border-b border-border flex flex-col gap-2">
           <div className="text-[10px] uppercase font-display font-medium tracking-[0.05em] text-text-secondary">Session Stats</div>
           <div className="flex items-center gap-0 divide-x divide-border">
             <div className="flex flex-col pr-4">
               <span className="text-base font-data font-semibold text-text-primary leading-none">{progress.done}</span>
               <span className="text-[10px] font-data text-text-tertiary mt-0.5">{progress.total > 0 ? `of ${progress.total} done` : 'done'}</span>
             </div>
             <div className="flex flex-col px-4">
               <span className="text-base font-data font-semibold text-text-primary leading-none">{sessionDone}</span>
               <span className="text-[10px] font-data text-text-tertiary mt-0.5">this session</span>
             </div>
             <div className="flex flex-col pl-4">
               <span className="text-base font-data font-semibold text-text-primary leading-none">{imagesPerHour > 0 ? imagesPerHour : '—'}</span>
               <span className="text-[10px] font-data text-text-tertiary mt-0.5">img / hr</span>
             </div>
             {failedSaves.size > 0 && (
               <div className="flex flex-col pl-4">
                 <span className="text-base font-data font-semibold text-accent-red leading-none">{failedSaves.size}</span>
                 <span className="text-[10px] font-data text-accent-red/70 mt-0.5">failed</span>
               </div>
             )}
           </div>
           {progress.total > 0 && (
             <div className="w-full h-0.5 bg-surface-2 rounded-full overflow-hidden">
               <div className="h-full bg-accent-cyan transition-all duration-500 ease-out" style={{ width: `${Math.min(100, (progress.done / progress.total) * 100)}%` }} />
             </div>
           )}
         </div>

         {/* Recently Annotated */}
         <div className="px-5 py-3 border-b border-border flex flex-col gap-2">
           <div className="text-[10px] uppercase font-display font-medium tracking-[0.05em] text-text-secondary">Recently Annotated</div>
           {recentlyAnnotated.length === 0 ? (
             <div className="text-[11px] text-text-tertiary font-body italic">None yet this session.</div>
           ) : (
             <div className="flex flex-col gap-1">
               {recentlyAnnotated.map((name, i) => (
                 <div key={i} className="text-[11px] font-data text-text-secondary truncate py-0.5 flex items-center gap-1.5">
                   <span className="w-1 h-1 rounded-full bg-text-tertiary shrink-0" />
                   {name}
                 </div>
               ))}
             </div>
           )}
           <div className="text-[10px] text-text-tertiary font-body">Use Jump to Image below to revisit.</div>
         </div>

         {/* Jump to image */}
         <div className="p-5 flex-1 flex flex-col gap-3">
           <div className="text-[10px] uppercase font-display font-medium tracking-[0.05em] text-text-secondary">Jump to Image</div>
           <div className="flex flex-col gap-2">
             <div className="flex gap-2">
               <input
                 type="text"
                 value={imageSearch}
                 onChange={e => { setImageSearch(e.target.value); setImageSearchError('') }}
                 onKeyDown={e => e.key === 'Enter' && handleJumpToImage()}
                 placeholder="Search filename..."
                 className="flex-1 bg-surface-2 border border-border rounded px-3 py-1.5 text-xs font-data text-text-primary placeholder:text-text-tertiary focus:border-accent-cyan focus:outline-none"
               />
               <button
                 onClick={handleJumpToImage}
                 disabled={imageSearchLoading || !imageSearch.trim()}
                 className="h-[30px] w-[30px] flex items-center justify-center bg-accent-cyan hover:bg-accent-cyan-hover text-bg rounded disabled:opacity-40 transition-all duration-150"
               >
                 {imageSearchLoading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} strokeWidth={2.5} />}
               </button>
             </div>
             {imageSearchError && (
               <div className="text-[11px] text-accent-red font-body flex items-center gap-1">
                 <AlertCircle size={11} /> {imageSearchError}
               </div>
             )}
             <div className="text-[10px] text-text-tertiary font-body">Partial names work. Opens in annotation view.</div>
           </div>

           <a href={`/projects/${id}`} className="mt-auto flex items-center justify-center gap-2 w-full py-2.5 bg-accent-cyan text-bg font-display font-medium rounded hover:bg-accent-cyan-hover transition-all duration-150 ease-out text-sm">
             <Play size={14} strokeWidth={1.5} fill="currentColor" /> Next Pending
           </a>
         </div>
      </div>

      
      <div className="flex-1 relative z-10 bg-bg flex flex-col min-w-0">
         {flagReason !== null && (
            <div className="bg-accent-magenta border-b border-accent-magenta/50 px-6 py-2.5 flex items-center justify-between text-bg z-20 shadow-md">
               <div className="flex items-center gap-2">
                 <div className="font-display font-semibold text-sm">Reviewer Note:</div>
                 <div className="font-body text-sm font-medium">{flagReason}</div>
               </div>
            </div>
         )}
         
         <div className="flex-1 relative flex items-center justify-center min-h-0">
          <AnnotationCanvas 
            imgSrc={imgSrc} 
            classes={classes} 
            initialBoxes={existingBoxes}
            onSave={handleSave} 
            onSkip={handleSkip}
            onUndo={handleUndo}
            imageId={activeImage.id}
            fileName={activeImage?.file_name}
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
