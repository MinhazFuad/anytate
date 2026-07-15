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

    // 2. Look up the active taxonomy and scene metadata versions for this project
    const { data: taxVersion, error: taxErr } = await supabase
      .from('taxonomy_versions')
      .select('id')
      .eq('project_id', validatedData.project_id)
      .eq('is_active', true)
      .single()

    const { data: sceneVersion, error: sceneErr } = await supabase
      .from('scene_metadata_field_sets')
      .select('id')
      .eq('project_id', validatedData.project_id)
      .eq('is_active', true)
      .single()

    if (taxErr || sceneErr || !taxVersion || !sceneVersion) {
      return NextResponse.json({ error: 'Missing active taxonomy or scene metadata version for this project' }, { status: 400 })
    }

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
        taxonomy_version_id: taxVersion.id,
        scene_metadata_field_set_id: sceneVersion.id,
        grounded_instances: validatedData.boxes,
        annotator_id: user.id,
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
        taxonomy_version_id: taxVersion.id,
        scene_metadata_field_set_id: sceneVersion.id,
        grounded_instances: validatedData.boxes,
        scene_context: {},
        derived_diagnostics: {},
        annotator_id: user.id,
        status: 'pending'
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
