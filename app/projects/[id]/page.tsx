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
        
        const { data: existingImage } = await supabase.from('images').select('*').eq('project_id', id).eq('status', 'pending').limit(1).maybeSingle()
        
        let targetFileId = ''
        if (existingImage) {
          setActiveImage(existingImage)
          targetFileId = existingImage.drive_file_id
        } else {
          // Sync images: find the first file from Drive that isn't already in the DB
          const listRes = await fetch(`/api/drive/list?folderId=${project.drive_image_folder_id}`)
          const listData = await listRes.json()
          
          if (!listRes.ok || !listData.files || listData.files.length === 0) {
            throw new Error('No images found in Drive folder')
          }

          // Get all existing image IDs from DB to avoid duplicates
          const { data: existingAll } = await supabase.from('images').select('drive_file_id').eq('project_id', id)
          const existingIds = new Set(existingAll?.map(img => img.drive_file_id) || [])
          
          const nextFile = listData.files.find((f: any) => !existingIds.has(f.id))
          
          if (!nextFile) {
            throw new Error('All images in this folder have been annotated!')
          }

          // Insert next unannotated image as pending
          const { data: newImg, error: imgErr } = await supabase.from('images').insert({
            project_id: id as string,
            drive_file_id: nextFile.id,
            file_name: nextFile.name
          }).select().single()
          
          if (imgErr) throw imgErr
          
          setActiveImage(newImg)
          targetFileId = nextFile.id
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

      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    
    initWorkspace()
  }, [id, supabase])

  const handleSave = async (boxes: any[]) => {
    try {
      setLoading(true)
      
      // We will send this to our API for Zod validation before saving
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
      
      alert('Saved successfully! (Reloading would fetch next image...)')
      
      // To get the next image, you would reload or update state. 
      // For Milestone 4, this is sufficient to show the loop.
      window.location.reload()
      
    } catch (err: any) {
      alert("Error saving: " + err.message)
      setLoading(false)
    }
  }

  const handleSkip = () => {
    alert('Skipped. (Next image logic to be added...)')
    // window.location.reload()
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background text-text">Loading workspace...</div>
  if (error) return <div className="min-h-screen flex items-center justify-center bg-background text-warn">{error}</div>

  return (
    <div className="h-screen w-screen overflow-hidden bg-black text-white">
      <AnnotationCanvas 
        imgSrc={imgSrc} 
        classes={classes} 
        onSave={handleSave} 
        onSkip={handleSkip} 
      />
    </div>
  )
}
