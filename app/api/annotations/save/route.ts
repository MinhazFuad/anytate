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

    // 3. Save to Annotations table
    const { data: annotation, error: annotationErr } = await supabase.from('annotations').insert({
      image_id: validatedData.image_id,
      taxonomy_version_id: taxVersion.id,
      scene_metadata_field_set_id: sceneVersion.id,
      grounded_instances: validatedData.boxes,
      scene_context: {}, // Scene context would be passed in a full implementation
      derived_diagnostics: {},
      annotator_id: user.id,
      status: 'pending' // pending review
    }).select().single()

    if (annotationErr) {
      // If unique constraint violation on image_id, they already annotated it
      if (annotationErr.code === '23505') {
        return NextResponse.json({ error: 'Image already annotated' }, { status: 409 })
      }
      throw annotationErr
    }

    // 4. Update the Image status to 'done'
    const { error: imageErr } = await supabase.from('images').update({ status: 'done' }).eq('id', validatedData.image_id)
    if (imageErr) throw imageErr

    return NextResponse.json({ success: true, annotationId: annotation.id })

  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
