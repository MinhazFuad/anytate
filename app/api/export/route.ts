import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function getScaledResolution(originalWidth: number, originalHeight: number, maxDim: number) {
  let w = originalWidth
  let h = originalHeight
  if (w > maxDim || h > maxDim) {
    if (w > h) {
      h = Math.round((h * maxDim) / w)
      w = maxDim
    } else {
      w = Math.round((w * maxDim) / h)
      h = maxDim
    }
  }
  return { width: w, height: h }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { project_id, format = 'anytate', folder_id } = await request.json()
    if (!project_id) return NextResponse.json({ error: 'Missing project_id' }, { status: 400 })

    // 1. Get project info
    const { data: project } = await supabase.from('projects').select('*').eq('id', project_id).single()
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    // 2. Fetch active taxonomy classes to map class_key -> ID for YOLO/COCO
    const { data: taxVersion } = await supabase.from('taxonomy_versions').select('id').eq('project_id', project_id).eq('is_active', true).single()
    const { data: classes } = await supabase.from('taxonomy_classes').select('*').eq('taxonomy_version_id', taxVersion?.id).order('sort_order')
    
    const classMap: Record<string, number> = {}
    classes?.forEach((c, idx) => {
       classMap[c.class_key] = idx
    })

    // 3. Fetch all annotations
    // We export any annotation that exists. Or maybe only 'approved'? Let's export all for now.
    let query = supabase.from('annotations')
      .select('grounded_instances, scene_context, derived_diagnostics, images!inner(file_name, width, height, drive_folder_id)')
      .eq('images.project_id', project_id)
      
    if (folder_id) {
       // If folder_id is "unknown", filter for null or missing. Otherwise exact match.
       if (folder_id === 'unknown') {
         query = query.is('images.drive_folder_id', null)
       } else {
         query = query.eq('images.drive_folder_id', folder_id)
       }
    }

    const { data: annotations } = await query

    if (!annotations || annotations.length === 0) {
      return NextResponse.json({ error: 'No annotations found for this selection' }, { status: 400 })
    }

    const files: { name: string, content: string }[] = []
    let zipFilename = ''

    if (format === 'anytate') {
       zipFilename = `${project.name.replace(/\s+/g, '_')}_anytate.zip`
       annotations.forEach((ann: any) => {
         const baseName = ann.images.file_name.substring(0, ann.images.file_name.lastIndexOf('.')) || ann.images.file_name
         
         const scaledRes = getScaledResolution(
            ann.images.width || 1000, 
            ann.images.height || 1000, 
            project.preprocessing?.max_dim || 1024
         )
         
         const formattedAnn = {
           image_id: ann.images.file_name,
           image_resolution: scaledRes,
           coord_format: "ymin_xmin_ymax_xmax_0to1000",
           global_scene_context: ann.scene_context || {},
           grounded_instances: ann.grounded_instances.map((b: any, idx: number) => ({
             instance_id: idx + 1,
             object_name: b.class_key,
             bbox_2d: [b.ymin, b.xmin, b.ymax, b.xmax],
             fcot: b.fcot
           })),
           total_objects: ann.grounded_instances.length,
           environmental_diagnostics: ann.derived_diagnostics || {}
         }
         
         files.push({ name: `${baseName}.json`, content: JSON.stringify(formattedAnn, null, 2) })
       })
    } else if (format === 'yolo') {
       zipFilename = `${project.name.replace(/\s+/g, '_')}_yolo.zip`
       
       // classes.txt
       const classLines = classes?.map(c => c.class_key).join('\n') || ''
       files.push({ name: 'classes.txt', content: classLines })
       
       annotations.forEach((ann: any) => {
          const img = ann.images
          const lines = ann.grounded_instances.map((b: any) => {
             const classIdx = classMap[b.class_key] ?? 0
             // Convert 0-1000 to center normalized coordinates
             const xCenter = ((b.xmin + b.xmax) / 2) / 1000
             const yCenter = ((b.ymin + b.ymax) / 2) / 1000
             const w = (b.xmax - b.xmin) / 1000
             const h = (b.ymax - b.ymin) / 1000
             return `${classIdx} ${xCenter.toFixed(6)} ${yCenter.toFixed(6)} ${w.toFixed(6)} ${h.toFixed(6)}`
          })
          const baseName = img.file_name.substring(0, img.file_name.lastIndexOf('.')) || img.file_name
          files.push({ name: `${baseName}.txt`, content: lines.join('\n') })
       })
    } else if (format === 'coco') {
       zipFilename = `${project.name.replace(/\s+/g, '_')}_coco.zip`
       
       // COCO is typically 1 giant file
       const coco = {
         images: [],
         annotations: [],
         categories: classes?.map((c, i) => ({ id: i, name: c.class_key, supercategory: "none" }))
       }
       
       let annId = 1
       annotations.forEach((ann: any, imgIdx) => {
         const img = ann.images
         const scaledRes = getScaledResolution(
            img.width || 1000, 
            img.height || 1000, 
            project.preprocessing?.max_dim || 1024
         )
         coco.images.push({ id: imgIdx, file_name: img.file_name, width: scaledRes.width, height: scaledRes.height } as never)
         
         ann.grounded_instances.forEach((b: any) => {
            const w = (b.xmax - b.xmin) / 1000 * scaledRes.width
            const h = (b.ymax - b.ymin) / 1000 * scaledRes.height
            const x = (b.xmin) / 1000 * scaledRes.width
            const y = (b.ymin) / 1000 * scaledRes.height
            
            coco.annotations.push({
               id: annId++,
               image_id: imgIdx,
               category_id: classMap[b.class_key] ?? 0,
               bbox: [x, y, w, h],
               area: w * h,
               iscrowd: 0
            } as never)
         })
         
         if (ann.scene_context && Object.keys(ann.scene_context).length > 0) {
            (coco as any).images[imgIdx].scene_context = ann.scene_context
         }
       })
       // If user insists on separate files per image for COCO, they usually mean they want native format.
       // We'll return 1 file for COCO since it's meant to be a monolithic format.
       files.push({ name: 'coco_annotations.json', content: JSON.stringify(coco, null, 2) })
    }

    // 4. We skip pushing ZIP to Google Drive directly from this serverless function because we'd need jszip on server.
    // Instead we will let the client handle zipping and download.
    return NextResponse.json({ success: true, zipFilename, files })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
