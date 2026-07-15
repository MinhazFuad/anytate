'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AnnotationCanvas from '@/components/AnnotationCanvas'

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
  
  useEffect(() => {
    async function initWorkspace() {
      try {
        // 1. Get project
        const { data: project } = await supabase.from('projects').select('*').eq('id', id).single()
        if (!project) throw new Error('Project not found')

        // 2. Get active taxonomy classes
        const { data: taxVersion } = await supabase.from('taxonomy_versions').select('id').eq('project_id', id).eq('is_active', true).single()
        if (taxVersion) {
          const { data: classData } = await supabase.from('taxonomy_classes').select('*').eq('taxonomy_version_id', taxVersion.id).order('sort_order')
          if (classData) setClasses(classData)
        }
        
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
          const { data: ann } = await supabase.from('annotations').select('grounded_instances').eq('image_id', specificImg.id).maybeSingle()
          if (ann && ann.grounded_instances) {
             setExistingBoxes(ann.grounded_instances)
          }

        } else {
          // Normal flow: get first pending image, or sync if none
          const { data: pendingImage } = await supabase.from('images').select('*').eq('project_id', id).eq('status', 'pending').limit(1).maybeSingle()
          
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

        // 4. Fetch the image bytes using access token
        const tokenRes = await fetch('/api/drive/refresh')
        const tokenData = await tokenRes.json()
        if (!tokenRes.ok) throw new Error(tokenData.error)
        
        const imgRes = await fetch(`https://www.googleapis.com/drive/v3/files/${targetFileId}?alt=media`, {
          headers: { Authorization: `Bearer ${tokenData.accessToken}` }
        })
        if (!imgRes.ok) throw new Error('Failed to load image bytes from Drive')
        
        const blob = await imgRes.blob()
        setImgSrc(URL.createObjectURL(blob))

        // 5. Fetch a list of completed images for the sidebar
        const { data: doneImages } = await supabase.from('images').select('id, file_name').eq('project_id', id).eq('status', 'done').order('created_at', { ascending: false }).limit(20)
        setCompletedImages(doneImages || [])

        // 6. Background preload next 5 images (if we are in normal sequential mode)
        if (!imageIdParam) {
           setTimeout(async () => {
              try {
                const { data: pending } = await supabase.from('images').select('*').eq('project_id', id).eq('status', 'pending').neq('drive_file_id', targetFileId).limit(5)
                if (!pending) return
                
                const { data: { user } } = await supabase.auth.getUser()
                const newQueue = []

                for (const img of pending) {
                   const bgRes = await fetch(`https://www.googleapis.com/drive/v3/files/${img.drive_file_id}?alt=media`, {
                      headers: { Authorization: `Bearer ${tokenData.accessToken}` }
                   })
                   if (bgRes.ok) {
                      const bgBlob = await bgRes.blob()
                      let draftBoxes = []
                      if (user) {
                         const { data: draft } = await supabase.from('drafts').select('draft_state').eq('image_id', img.id).eq('user_id', user.id).maybeSingle()
                         if (draft?.draft_state?.boxes) draftBoxes = draft.draft_state.boxes
                      }
                      newQueue.push({ image: img, blobUrl: URL.createObjectURL(bgBlob), draftBoxes })
                   }
                }
                setPreloadQueue(newQueue)
              } catch (e) {
                 console.error("Preload error", e)
              }
           }, 500)
        }

      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    
    initWorkspace()
  }, [id, supabase])

  const [completedImages, setCompletedImages] = useState<any[]>([])
  const [preloadQueue, setPreloadQueue] = useState<{image: any, blobUrl: string, draftBoxes: any[]}[]>([])

  const handleSave = async (boxes: any[]) => {
    try {
      setLoading(true)
      
      const payload = {
        image_id: activeImage.id,
        project_id: id,
        boxes: boxes.map(b => ({
          class_key: b.class_key,
          ymin: b.bbox[0],
          xmin: b.bbox[1],
          ymax: b.bbox[2],
          xmax: b.bbox[3]
        }))
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
            setLoading(false)
            
            // Refetch done images for sidebar
            const { data: doneImages } = await supabase.from('images').select('id, file_name').eq('project_id', id).eq('status', 'done').order('created_at', { ascending: false }).limit(20)
            setCompletedImages(doneImages || [])
         } else {
            window.location.reload()
         }
      }
      
    } catch (err: any) {
      alert("Error saving: " + err.message)
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
          setLoading(false)
       } else {
          window.location.reload()
       }
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background text-text">Loading workspace...</div>
  if (error) return <div className="min-h-screen flex items-center justify-center bg-background text-warn">{error}</div>

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-black text-white relative">
      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-purple-500/5 pointer-events-none z-0"></div>
      
      <div className="w-80 border-r border-white/10 glass flex flex-col z-10 relative shadow-2xl">
         <div className="p-6 border-b border-white/5 font-extrabold flex flex-col gap-3">
           <div className="text-xl tracking-tight text-white">Project Workspace</div>
           <a href={`/projects/${id}/dashboard`} className="text-xs font-semibold text-accent hover:text-white transition-colors flex items-center gap-1">
              <span className="text-lg leading-none">←</span> Back to Dashboard
           </a>
         </div>
         <div className="p-6 flex-1 overflow-y-auto">
           <div className="mb-4 text-xs font-bold uppercase tracking-widest text-muted flex items-center justify-between">
              <span>Completed</span>
              <span className="bg-white/10 px-2 py-1 rounded-full text-white">{completedImages.length}</span>
           </div>
           <div className="flex flex-col gap-3">
             {completedImages.map(img => (
               <a 
                 key={img.id} 
                 href={`/projects/${id}?imageId=${img.id}`}
                 className={`text-sm p-3 rounded-xl truncate border transition-all duration-300 ${activeImage.id === img.id ? 'bg-accent/20 border-accent/50 text-accent shadow-[0_0_15px_rgba(56,189,248,0.3)]' : 'glass hover:bg-white/5 border-white/5 text-muted hover:text-white'}`}
               >
                 {img.file_name}
               </a>
             ))}
           </div>
           
           <a href={`/projects/${id}`} className="mt-8 flex items-center justify-center gap-2 w-full py-3 btn-premium text-white font-bold rounded-xl shadow-lg">
             <span className="text-lg leading-none">▶</span> Start Next Pending
           </a>
         </div>
      </div>
      
      <div className="flex-1 relative z-10 bg-black/40">
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
  )
}
