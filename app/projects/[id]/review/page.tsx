'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Check, X } from 'lucide-react'
import AnnotationCanvas from '@/components/AnnotationCanvas'

export default function ReviewQueuePage() {
  const { id } = useParams()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [classes, setClasses] = useState<any[]>([])
  const [activeImage, setActiveImage] = useState<any>(null)
  const [imgSrc, setImgSrc] = useState<string>('')
  const [existingBoxes, setExistingBoxes] = useState<any[]>([])
  const [queue, setQueue] = useState<any[]>([])
  
  useEffect(() => {
    async function initReview() {
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

        // 3. Get images that are 'done' and whose annotation is 'pending' (pending review)
        // Since we can't easily join on the client, we'll fetch annotations that are pending, then fetch their images
        const { data: pendingAnnotations } = await supabase.from('annotations').select('id, image_id, grounded_instances').eq('status', 'pending')
        
        if (!pendingAnnotations || pendingAnnotations.length === 0) {
          throw new Error('No images pending review! You are all caught up.')
        }

        const imageIds = pendingAnnotations.map(a => a.image_id)
        const { data: images } = await supabase.from('images').select('*').eq('project_id', id).eq('drive_folder_id', project.drive_image_folder_id).in('id', imageIds)

        if (!images || images.length === 0) {
           throw new Error('No images pending review.')
        }

        setQueue(images)
        
        let targetImg = images[0]
        const urlParams = new URLSearchParams(window.location.search)
        const imageIdParam = urlParams.get('imageId')
        if (imageIdParam) {
           targetImg = images.find(img => img.id === imageIdParam) || images[0]
        }
        
        setActiveImage(targetImg)
        const targetAnn = pendingAnnotations.find(a => a.image_id === targetImg.id)
        if (targetAnn) {
           setExistingBoxes(targetAnn.grounded_instances)
        }

        // 4. Fetch the image bytes using access token
        const tokenRes = await fetch('/api/drive/refresh')
        const tokenData = await tokenRes.json()
        if (!tokenRes.ok) throw new Error(tokenData.error)
        
        const imgRes = await fetch(`https://www.googleapis.com/drive/v3/files/${targetImg.drive_file_id}?alt=media`, {
          headers: { Authorization: `Bearer ${tokenData.accessToken}` }
        })
        if (!imgRes.ok) throw new Error('Failed to load image bytes from Drive')
        
        const blob = await imgRes.blob()
        setImgSrc(URL.createObjectURL(blob))

      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    
    initReview()
  }, [id, supabase])

  const handleUpdateStatus = async (status: 'approved' | 'flagged') => {
    try {
      setLoading(true)
      const { error } = await supabase.from('annotations').update({ status }).eq('image_id', activeImage.id)
      if (error) throw error
      
      if (window.location.search) {
         window.location.href = `/projects/${id}/review`
      } else {
         window.location.reload()
      }
    } catch(err: any) {
       toast.error("Error updating status: " + err.message)
       setLoading(false)
    }
  }

  // The reviewer can also edit and save!
  const handleSaveEdit = async (boxes: any[]) => {
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
      
      toast.success('Edits saved! You can now Approve or Flag.')
      setLoading(false)
      
    } catch (err: any) {
      toast.error("Error saving: " + err.message)
      setLoading(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-bg text-text-primary">Loading review queue...</div>
  if (error) return <div className="min-h-screen flex items-center justify-center bg-bg flex-col gap-4">
    <div className="text-accent-red font-display font-medium">{error}</div>
    <a href={`/projects/${id}/dashboard`} className="text-accent-cyan hover:text-accent-cyan-hover underline font-display font-medium">Back to Dashboard</a>
  </div>

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text-primary relative font-body">
      
      <div className="w-80 border-r border-border bg-surface flex flex-col z-10 relative">
         <div className="p-6 border-b border-border flex flex-col gap-3">
           <div className="flex items-center justify-between mb-4">
             <Link href={`/projects/${id}/dashboard`} className="text-text-secondary hover:text-text-primary text-sm font-display font-medium transition-all duration-150 ease-out flex items-center gap-2 w-fit">
                <ArrowLeft size={18} strokeWidth={1.5} /> Back to Dashboard
             </Link>
           </div>
         </div>
         
         <div className="p-6 flex-1 overflow-y-auto">
           <div className="mb-4 text-[11px] font-display font-medium uppercase tracking-[0.03em] text-text-secondary flex items-center justify-between">
              <span>Pending Review</span>
              <span className="bg-surface-2 border border-border px-2 py-0.5 rounded-sm text-text-primary font-data">{queue.length}</span>
           </div>
           
           <div className="flex flex-col gap-2">
             {queue.map(img => (
               <a 
                 key={img.id} 
                 href={`/projects/${id}/review?imageId=${img.id}`}
                 className={`text-sm p-3 rounded-md truncate border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring ${activeImage.id === img.id ? 'bg-accent-cyan-muted border-accent-cyan text-accent-cyan' : 'bg-surface-2 border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover hover:border-border-strong'}`}
               >
                 {img.file_name}
               </a>
             ))}
           </div>
         </div>
         
         <div className="p-6 border-t border-border flex flex-col gap-3 bg-surface-2">
            <button onClick={() => handleUpdateStatus('approved')} className="w-full py-2.5 bg-transparent text-accent-green border border-accent-green/50 rounded-md font-display font-medium hover:bg-accent-green/10 transition-all duration-150 ease-out flex justify-center items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring">
               <Check size={18} strokeWidth={1.5} /> Approve
            </button>
            <button onClick={() => handleUpdateStatus('flagged')} className="w-full py-2.5 bg-transparent text-accent-magenta border border-accent-magenta/50 rounded-md font-display font-medium hover:bg-accent-magenta/10 transition-all duration-150 ease-out flex justify-center items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring">
               <X size={18} strokeWidth={1.5} /> Flag Issues
            </button>
         </div>
      </div>
      
      <div className="flex-1 relative z-10 bg-surface-2">
        <AnnotationCanvas 
          imgSrc={imgSrc} 
          classes={classes} 
          initialBoxes={existingBoxes}
          onSave={handleSaveEdit} 
          onSkip={() => {}}
          imageId={activeImage.id}
        />
      </div>
    </div>
  )
}
