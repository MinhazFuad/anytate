'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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
        const { data: images } = await supabase.from('images').select('*').eq('project_id', id).in('id', imageIds)

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
       alert("Error updating status: " + err.message)
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
      
      alert('Edits saved! You can now Approve or Flag.')
      setLoading(false)
      
    } catch (err: any) {
      alert("Error saving: " + err.message)
      setLoading(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background text-text">Loading review queue...</div>
  if (error) return <div className="min-h-screen flex items-center justify-center bg-background flex-col gap-4">
    <div className="text-warn">{error}</div>
    <a href={`/projects/${id}/dashboard`} className="text-accent underline">Back to Dashboard</a>
  </div>

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-black text-white relative">
      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-purple-500/5 pointer-events-none z-0"></div>
      
      <div className="w-80 border-r border-white/10 glass flex flex-col z-10 relative shadow-2xl">
         <div className="p-6 border-b border-white/5 font-extrabold flex flex-col gap-3">
           <div className="text-xl tracking-tight text-white">Review Queue</div>
           <a href={`/projects/${id}/dashboard`} className="text-xs font-semibold text-accent hover:text-white transition-colors flex items-center gap-1">
              <span className="text-lg leading-none">←</span> Back to Dashboard
           </a>
         </div>
         
         <div className="p-6 flex-1 overflow-y-auto">
           <div className="mb-4 text-xs font-bold uppercase tracking-widest text-muted flex items-center justify-between">
              <span>Pending Review</span>
              <span className="bg-white/10 px-2 py-1 rounded-full text-white">{queue.length}</span>
           </div>
           
           <div className="flex flex-col gap-3">
             {queue.map(img => (
               <a 
                 key={img.id} 
                 href={`/projects/${id}/review?imageId=${img.id}`}
                 className={`text-sm p-3 rounded-xl truncate border transition-all duration-300 ${activeImage.id === img.id ? 'bg-accent/20 border-accent/50 text-accent shadow-[0_0_15px_rgba(56,189,248,0.3)]' : 'glass hover:bg-white/5 border-white/5 text-muted hover:text-white'}`}
               >
                 {img.file_name}
               </a>
             ))}
           </div>
         </div>
         
         <div className="p-6 border-t border-white/5 flex flex-col gap-4 bg-black/20">
            <button onClick={() => handleUpdateStatus('approved')} className="w-full py-3 bg-green-500/10 text-green-400 border border-green-500/30 rounded-xl font-bold hover:bg-green-500/20 hover:border-green-500/50 hover:shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-all flex justify-center items-center gap-2">
               <span className="text-lg">✓</span> Approve
            </button>
            <button onClick={() => handleUpdateStatus('flagged')} className="w-full py-3 bg-warn/10 text-warn border border-warn/30 rounded-xl font-bold hover:bg-warn/20 hover:border-warn/50 hover:shadow-[0_0_15px_rgba(244,63,94,0.3)] transition-all flex justify-center items-center gap-2">
               <span className="text-lg">✕</span> Flag Issues
            </button>
         </div>
      </div>
      
      <div className="flex-1 relative z-10 bg-black/40">
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
