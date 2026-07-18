import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { annotationSaveSchema } from '@/lib/zodSchemas'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // 1. Zod Validation (SERVER-SIDE)
    const validatedData = annotationSaveSchema.parse(body)

    // 2. Look up the active taxonomy and scene metadata versions for this project if not provided
    let taxVersionId = validatedData.taxonomy_version_id
    if (!taxVersionId) {
      const { data: taxVersion } = await supabase
        .from('taxonomy_versions')
        .select('id')
        .eq('project_id', validatedData.project_id)
        .eq('is_active', true)
        .single()
      if (taxVersion) taxVersionId = taxVersion.id
    }

    let sceneVersionId = validatedData.scene_metadata_field_set_id
    if (!sceneVersionId) {
      const { data: sceneVersion } = await supabase
        .from('scene_metadata_field_sets')
        .select('id')
        .eq('project_id', validatedData.project_id)
        .eq('is_active', true)
        .single()
      if (sceneVersion) sceneVersionId = sceneVersion.id
    }

    if (!taxVersionId) {
      return NextResponse.json({ error: 'Missing taxonomy version' }, { status: 400 })
    }

    // 2.2 Check if project has Solo Mode enabled
    const { data: projectData } = await supabase
      .from('projects')
      .select('solo_mode')
      .eq('id', validatedData.project_id)
      .single()
      
    const finalStatus = projectData?.solo_mode ? 'approved' : 'pending'

    // 2.5 Calculate derived diagnostics
    let primary_pollutant = "None"
    if (validatedData.boxes.length > 0) {
      const counts: Record<string, number> = {}
      let maxCount = 0
      for (const b of validatedData.boxes) {
        counts[b.class_key] = (counts[b.class_key] || 0) + 1
        if (counts[b.class_key] > maxCount) {
          maxCount = counts[b.class_key]
          primary_pollutant = b.class_key
        }
      }
    }
    const derived_diagnostics = { primary_pollutant }

    // 3. Check if annotation already exists
    const { data: existingAnnotation } = await supabase
      .from('annotations')
      .select('id, grounded_instances')
      .eq('image_id', validatedData.image_id)
      .maybeSingle()

    let annotationId = ''

    if (existingAnnotation) {
      // It's an EDIT
      annotationId = existingAnnotation.id
      
      const { error: updateErr } = await supabase.from('annotations').update({
        taxonomy_version_id: taxVersionId,
        scene_metadata_field_set_id: sceneVersionId || undefined,
        grounded_instances: validatedData.boxes,
        scene_context: validatedData.scene_context || {},
        derived_diagnostics: derived_diagnostics,
        annotator_id: user.id,
        status: finalStatus,
        updated_at: new Date().toISOString()
      }).eq('id', annotationId)
      
      if (updateErr) throw updateErr

      // Log to history
      await supabase.from('annotation_history').insert({
        annotation_id: annotationId,
        action_type: 'edit_instances',
        payload: {
          previous: existingAnnotation.grounded_instances,
          new: validatedData.boxes
        },
        created_by: user.id
      })
    } else {
      // It's a NEW save
      const { data: newAnn, error: insertErr } = await supabase.from('annotations').insert({
        image_id: validatedData.image_id,
        taxonomy_version_id: taxVersionId,
        scene_metadata_field_set_id: sceneVersionId || undefined,
        grounded_instances: validatedData.boxes,
        scene_context: validatedData.scene_context || {},
        derived_diagnostics: derived_diagnostics,
        annotator_id: user.id,
        status: finalStatus
      }).select().single()

      if (insertErr) throw insertErr
      annotationId = newAnn.id

      // Log to history
      await supabase.from('annotation_history').insert({
        annotation_id: annotationId,
        action_type: 'initial_save',
        payload: {
          new: validatedData.boxes
        },
        created_by: user.id
      })
      
      // Update the Image status to 'done' only on initial save
      const { error: imageErr } = await supabase.from('images').update({ status: 'done' }).eq('id', validatedData.image_id)
      if (imageErr) throw imageErr

      // Notify reviewers and owners
      const { data: reviewers } = await supabase.from('project_members')
        .select('user_id')
        .eq('project_id', validatedData.project_id)
        .in('role', ['reviewer', 'owner'])
      
      if (reviewers && reviewers.length > 0) {
        // fetch image filename for a nice message
        const { data: imgData } = await supabase.from('images').select('file_name').eq('id', validatedData.image_id).single()
        
        const notifications = reviewers
           .filter((r: any) => r.user_id !== user.id) // don't notify oneself
           .map((r: any) => ({
              user_id: r.user_id,
              project_id: validatedData.project_id,
              type: 'review_ready',
              message: `New image ready for review: ${imgData?.file_name || 'unknown'}`,
              link: `/projects/${validatedData.project_id}/review`
           }))
        
        if (notifications.length > 0) {
           await supabase.from('notifications').insert(notifications)
        }
      }
    }

    // 4. Delete the user's draft if it exists
    await supabase.from('drafts').delete().eq('image_id', validatedData.image_id).eq('user_id', user.id)

    return NextResponse.json({ success: true, annotationId })

  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
