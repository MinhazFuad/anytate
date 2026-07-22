'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Check, X, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import AnnotationCanvas from '@/components/AnnotationCanvas'

export default function ReviewQueuePage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [switchingImage, setSwitchingImage] = useState(false)
  const [error, setError] = useState('')
  const [classes, setClasses] = useState<any[]>([])
  const [activeImage, setActiveImage] = useState<any>(null)
  const [imgSrc, setImgSrc] = useState<string>('')
  const [existingBoxes, setExistingBoxes] = useState<any[]>([])
  const [queue, setQueue] = useState<any[]>([])
  const [sessionReviewed, setSessionReviewed] = useState(0)

  // Cache maps for zero-latency switching
  const annotationsMapRef = useRef<Record<string, any[]>>({})
  const blobUrlCacheRef = useRef<Record<string, string>>({})
  const accessTokenRef = useRef<string>('')

  // Flag Modal state
  const [showFlagModal, setShowFlagModal] = useState(false)
  const [flagReasonInput, setFlagReasonInput] = useState('')
  const [isSubmittingFlag, setIsSubmittingFlag] = useState(false)

  // Helper to load image bytes into blobUrl cache
  const fetchImageBlob = async (driveFileId: string): Promise<string> => {
    if (blobUrlCacheRef.current[driveFileId]) {
      return blobUrlCacheRef.current[driveFileId]
    }
    
    if (!accessTokenRef.current) {
      const tokenRes = await fetch('/api/drive/refresh')
      const tokenData = await tokenRes.json()
      if (!tokenRes.ok) throw new Error(tokenData.error || 'Failed to refresh drive token')
      accessTokenRef.current = tokenData.accessToken
    }

    const imgRes = await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`, {
      headers: { Authorization: `Bearer ${accessTokenRef.current}` }
    })
    
    if (!imgRes.ok) {
      const tokenRes = await fetch('/api/drive/refresh')
      const tokenData = await tokenRes.json()
      if (tokenRes.ok) {
        accessTokenRef.current = tokenData.accessToken
        const retryRes = await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`, {
          headers: { Authorization: `Bearer ${accessTokenRef.current}` }
        })
        if (!retryRes.ok) throw new Error('Failed to load image bytes from Drive')
        const blob = await retryRes.blob()
        const url = URL.createObjectURL(blob)
        blobUrlCacheRef.current[driveFileId] = url
        return url
      }
      throw new Error('Failed to load image bytes from Drive')
    }

    const blob = await imgRes.blob()
    const url = URL.createObjectURL(blob)
    blobUrlCacheRef.current[driveFileId] = url
    return url
  }

  // Switch active review image smoothly
  const selectReviewImage = async (targetImg: any) => {
    if (activeImage?.id === targetImg.id && imgSrc) return
    setSwitchingImage(true)
    try {
      setActiveImage(targetImg)
      
      const boxes = annotationsMapRef.current[targetImg.id] || []
      setExistingBoxes(boxes)

      const url = await fetchImageBlob(targetImg.drive_file_id)
      setImgSrc(url)
    } catch (err: any) {
      toast.error('Error loading image: ' + err.message)
    } finally {
      setSwitchingImage(false)
    }
  }

  useEffect(() => {
    async function initReview() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        const { data: member } = await supabase.from('project_members').select('role').eq('project_id', id).eq('user_id', user.id).single()
        if (!member) throw new Error('You are not a member of this project.')
        if (member.role === 'annotator') {
          router.replace(`/projects/${id}`)
          return
        }

        // 1. Get project
        const { data: project } = await supabase.from('projects').select('*').eq('id', id).single()
        if (!project) throw new Error('Project not found')
        
        if (project.solo_mode) {
          setError('Solo Mode is active for this project. The Review Queue is bypassed because all annotations are automatically approved upon save.')
          setLoading(false)
          return
        }

        // 2. Get active taxonomy classes
        const { data: taxVersion } = await supabase.from('taxonomy_versions').select('id').eq('project_id', id).eq('is_active', true).single()
        if (taxVersion) {
          const { data: classData } = await supabase.from('taxonomy_classes').select('*').eq('taxonomy_version_id', taxVersion.id).order('sort_order')
          if (classData) setClasses(classData)
        }

        // 3. Fetch pending annotations
        const { data: pendingAnnotations } = await supabase
          .from('annotations')
          .select('id, image_id, grounded_instances, images!inner(id, project_id, drive_folder_id)')
          .eq('images.project_id', id)
          .eq('images.drive_folder_id', project.drive_image_folder_id)
          .eq('status', 'pending')
        
        if (!pendingAnnotations || pendingAnnotations.length === 0) {
          setQueue([])
          setLoading(false)
          return
        }

        const annMap: Record<string, any[]> = {}
        pendingAnnotations.forEach(a => {
          annMap[a.image_id] = a.grounded_instances || []
        })
        annotationsMapRef.current = annMap

        const imageIds = pendingAnnotations.map(a => a.image_id)
        const { data: images } = await supabase
          .from('images')
          .select('id, file_name, drive_file_id, drive_folder_id, project_id, status')
          .eq('project_id', id)
          .eq('drive_folder_id', project.drive_image_folder_id)
          .in('id', imageIds)

        if (!images || images.length === 0) {
          setQueue([])
          setLoading(false)
          return
        }

        setQueue(images)
        
        let targetImg = images[0]
        const urlParams = new URLSearchParams(window.location.search)
        const imageIdParam = urlParams.get('imageId')
        if (imageIdParam) {
           targetImg = images.find(img => img.id === imageIdParam) || images[0]
        }
        
        setActiveImage(targetImg)
        setExistingBoxes(annMap[targetImg.id] || [])

        const url = await fetchImageBlob(targetImg.drive_file_id)
        setImgSrc(url)

        // Background preload next images
        const remaining = images.filter(img => img.id !== targetImg.id)
        remaining.slice(0, 4).forEach(img => {
          fetchImageBlob(img.drive_file_id).catch(() => {})
        })

      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    
    initReview()
  }, [id])

  const handleUpdateStatus = async (status: 'approved' | 'flagged', reasonNote?: string) => {
    if (!activeImage) return
    const notes = status === 'flagged' ? (reasonNote !== undefined ? reasonNote : flagReasonInput).trim() : ''

    try {
      if (status === 'flagged') setIsSubmittingFlag(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { data: ann } = await supabase.from('annotations').select('id').eq('image_id', activeImage.id).single()
      if (!ann) throw new Error("Annotation record not found")

      const { error } = await supabase.from('annotations').update({ 
        status,
        review_notes: notes || null,
        reviewed_by: user.id
      }).eq('id', ann.id)
      
      if (error) throw error

      await supabase.from('annotation_history').insert({
        annotation_id: ann.id,
        action_type: status === 'approved' ? 'approve' : 'flag',
        payload: { notes },
        created_by: user.id
      })

      if (status === 'flagged') {
         const { data: annotatorData } = await supabase.from('annotations').select('annotator_id').eq('id', ann.id).single()
         if (annotatorData?.annotator_id && annotatorData.annotator_id !== user.id) {
            await supabase.from('notifications').insert({
               user_id: annotatorData.annotator_id,
               project_id: id,
               type: 'flagged',
               message: `Your annotation on ${activeImage.file_name} was flagged: ${notes || 'No reason provided'}`,
               link: `/projects/${id}?imageId=${activeImage.id}`
            })
         }
      }
      
      toast.success(status === 'approved' ? `Approved ${activeImage.file_name}` : `Flagged ${activeImage.file_name}`)
      setSessionReviewed(s => s + 1)
      
      setShowFlagModal(false)
      setFlagReasonInput('')
      
      // Advance to next image smoothly without page refresh
      const nextQueue = queue.filter(img => img.id !== activeImage.id)
      setQueue(nextQueue)

      if (nextQueue.length > 0) {
        await selectReviewImage(nextQueue[0])
      } else {
        setActiveImage(null)
      }

    } catch(err: any) {
       toast.error("Error updating status: " + err.message)
    } finally {
       setIsSubmittingFlag(false)
    }
  }

  // The reviewer can also edit and save
  const handleSaveEdit = async (boxes: any[]) => {
    try {
      const payload = {
        image_id: activeImage.id,
        project_id: id,
        boxes: boxes.map(b => ({
          class_key: b.class_key,
          ymin: b.bbox[0],
          xmin: b.bbox[1],
          ymax: b.bbox[2],
          xmax: b.bbox[3],
          fcot: b.fcot
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
      
      annotationsMapRef.current[activeImage.id] = boxes
      setExistingBoxes(boxes)
      toast.success('Edits saved! You can now Approve or Flag.')
      
    } catch (err: any) {
      toast.error("Error saving: " + err.message)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center font-body animate-in fade-in duration-500">
        <Loader2 className="h-8 w-8 animate-spin text-accent-cyan mb-4" />
        <div className="text-text-primary font-display font-medium text-lg">Loading Review Queue...</div>
        <div className="text-text-secondary text-sm mt-2 max-w-[300px] text-center">
          Fetching pending annotations for review...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg flex-col gap-4">
        <div className="text-accent-red font-display font-medium">{error}</div>
        <Link href={`/projects/${id}/dashboard`} className="text-accent-cyan hover:text-accent-cyan-hover underline font-display font-medium">
          Back to Dashboard
        </Link>
      </div>
    )
  }

  // All caught up empty state
  if (!activeImage || queue.length === 0) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6 text-center font-body animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-full bg-accent-green/10 border border-accent-green/30 flex items-center justify-center mb-6 text-accent-green">
          <CheckCircle2 size={32} />
        </div>
        <h2 className="text-2xl font-display font-semibold text-text-primary mb-2">Review Queue Empty</h2>
        <p className="text-text-secondary text-sm max-w-md mb-8">
          All pending annotations in this project have been reviewed!
          {sessionReviewed > 0 && ` You reviewed ${sessionReviewed} image${sessionReviewed > 1 ? 's' : ''} in this session.`}
        </p>
        <Link
          href={`/projects/${id}/dashboard`}
          className="px-6 py-2.5 bg-accent-cyan text-bg font-display font-medium rounded hover:bg-accent-cyan-hover transition-all duration-150 ease-out text-sm"
        >
          Back to Dashboard
        </Link>
      </div>
    )
  }

  // Handle when reviewer unannotates an image
  const handleUndoInReview = (action: string, data: any) => {
    if (!activeImage) return
    toast.success(`Unannotated ${activeImage.file_name}. Removed from review queue.`)
    
    delete annotationsMapRef.current[activeImage.id]
    
    const nextQueue = queue.filter(img => img.id !== activeImage.id)
    setQueue(nextQueue)

    if (nextQueue.length > 0) {
      selectReviewImage(nextQueue[0])
    } else {
      setActiveImage(null)
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text-primary relative font-body">
      
      {/* Sidebar */}
      <div className="w-80 border-r border-border bg-surface flex flex-col z-10 relative">
         <div className="p-4 border-b border-border flex flex-col gap-3">
           <div className="flex items-center justify-between">
             <Link href={`/projects/${id}/dashboard`} className="text-text-secondary hover:text-text-primary text-sm font-display font-medium transition-all duration-150 ease-out flex items-center gap-2">
                <ArrowLeft size={18} strokeWidth={1.5} /> Back to Dashboard
             </Link>
             <img src="/logo.png" alt="AnyTate" className="h-5 w-auto object-contain shrink-0" />
           </div>
           {sessionReviewed > 0 && (
             <div className="text-xs font-data text-accent-green bg-accent-green/10 px-2.5 py-1 rounded border border-accent-green/20 w-fit">
               Session Reviewed: {sessionReviewed}
             </div>
           )}
         </div>
         
         <div className="p-4 flex-1 overflow-y-auto">
           <div className="mb-3 text-[11px] font-display font-medium uppercase tracking-[0.03em] text-text-secondary flex items-center justify-between">
              <span>Pending Review</span>
              <span className="bg-surface-2 border border-border px-2 py-0.5 rounded-sm text-text-primary font-data">{queue.length}</span>
           </div>
           
           <div className="flex flex-col gap-1.5">
             {queue.map(img => (
               <button
                 key={img.id} 
                 onClick={() => selectReviewImage(img)}
                 className={`text-sm p-2.5 rounded-md text-left truncate border transition-all duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring ${activeImage.id === img.id ? 'bg-accent-cyan-muted border-accent-cyan text-accent-cyan font-medium' : 'bg-surface-2 border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover hover:border-border-strong'}`}
               >
                 {img.file_name}
               </button>
             ))}
           </div>
         </div>
         
         <div className="p-4 border-t border-border flex flex-col gap-2.5 bg-surface-2">
            <button 
              onClick={() => handleUpdateStatus('approved')} 
              className="w-full py-2.5 bg-accent-green text-bg border-none rounded font-display font-medium hover:bg-accent-green/90 transition-all duration-150 ease-out flex justify-center items-center gap-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring shadow-sm"
            >
               <Check size={18} strokeWidth={2} /> Approve Annotation
            </button>
            <button 
              onClick={() => setShowFlagModal(true)} 
              className="w-full py-2.5 bg-transparent text-accent-magenta border border-accent-magenta/50 rounded font-display font-medium hover:bg-accent-magenta/10 transition-all duration-150 ease-out flex justify-center items-center gap-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring"
            >
               <X size={18} strokeWidth={1.5} /> Flag Issues
            </button>
         </div>
      </div>
      
      {/* Canvas Area */}
      <div className="flex-1 relative z-10 bg-bg flex flex-col min-w-0">
        {switchingImage && (
          <div className="absolute inset-0 bg-bg/60 backdrop-blur-[1px] z-30 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-accent-cyan" />
          </div>
        )}
        <AnnotationCanvas 
          imgSrc={imgSrc} 
          classes={classes} 
          initialBoxes={existingBoxes}
          onSave={handleSaveEdit} 
          onSkip={() => {}}
          onUndo={handleUndoInReview}
          imageId={activeImage.id}
          fileName={activeImage?.file_name}
        />
      </div>

      {/* Styled Flag Modal */}
      {showFlagModal && (
        <div className="fixed inset-0 bg-bg/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-surface border border-border rounded-lg max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3 text-accent-magenta">
              <div className="p-2 rounded bg-accent-magenta/10 border border-accent-magenta/20">
                <AlertTriangle size={20} />
              </div>
              <h3 className="font-display font-semibold text-lg text-text-primary">Flag Annotation</h3>
            </div>
            
            <p className="text-sm text-text-secondary leading-relaxed">
              Please provide feedback or a reason for flagging <span className="font-data text-text-primary">{activeImage.file_name}</span>. The annotator will be notified to revise it.
            </p>

            <textarea
              value={flagReasonInput}
              onChange={(e) => setFlagReasonInput(e.target.value)}
              placeholder="e.g. Missing bounding box on bottom right vehicle, incorrect class label..."
              rows={3}
              className="w-full bg-surface-2 border border-border rounded p-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-magenta focus:outline-none transition-colors font-body resize-none"
              autoFocus
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setShowFlagModal(false)
                  setFlagReasonInput('')
                }}
                disabled={isSubmittingFlag}
                className="px-4 py-2 bg-transparent border border-border text-text-secondary hover:text-text-primary rounded text-sm font-display font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdateStatus('flagged')}
                disabled={isSubmittingFlag}
                className="px-4 py-2 bg-accent-magenta text-bg hover:bg-accent-magenta/90 rounded text-sm font-display font-medium transition-colors flex items-center gap-2"
              >
                {isSubmittingFlag && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm Flag
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

