import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

// Use service role for admin operations to bypass RLS limitations on cascading delete
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is an owner/admin of this project
    const { data: project } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', id)
      .single()

    const { data: member } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    const isOwner = project?.owner_id === user.id || member?.role === 'owner'

    if (!isOwner) {
      return NextResponse.json({ error: 'Unauthorized. Only project owners can delete projects.' }, { status: 403 })
    }

    // Let Supabase handle cascading deletes via foreign keys
    // Assuming DB schema is set up with ON DELETE CASCADE
    // If not, we'd need to manually delete annotations, images, etc.
    // For safety, let's explicitly delete some top level resources if cascade isn't perfect.
    
    // We will just try to delete the project, and if it fails due to FK constraints,
    // we'll explicitly wipe the children first.
    let res = await supabaseAdmin.from('projects').delete().eq('id', id)
    
    if (res.error) {
       // Manual Cascade if needed
       const { data: images } = await supabaseAdmin.from('images').select('id').eq('project_id', id)
       const imageIds = images?.map(i => i.id) || []
       
       if (imageIds.length > 0) {
         const { data: anns } = await supabaseAdmin.from('annotations').select('id').in('image_id', imageIds)
         const annIds = anns?.map(a => a.id) || []
         
         if (annIds.length > 0) {
           await supabaseAdmin.from('annotation_history').delete().in('annotation_id', annIds)
         }
         await supabaseAdmin.from('annotations').delete().in('image_id', imageIds)
       }
       
       const { data: taxVersions } = await supabaseAdmin.from('taxonomy_versions').select('id').eq('project_id', id)
       const taxVIds = taxVersions?.map(v => v.id) || []
       if (taxVIds.length > 0) {
          await supabaseAdmin.from('taxonomy_classes').delete().in('taxonomy_version_id', taxVIds)
          await supabaseAdmin.from('taxonomy_versions').delete().in('id', taxVIds)
       }

       const { data: sceneSets } = await supabaseAdmin.from('scene_metadata_field_sets').select('id').eq('project_id', id)
       const sceneSetIds = sceneSets?.map(s => s.id) || []
       if (sceneSetIds.length > 0) {
          await supabaseAdmin.from('scene_metadata_fields').delete().in('field_set_id', sceneSetIds)
          await supabaseAdmin.from('scene_metadata_field_sets').delete().in('id', sceneSetIds)
       }

       await supabaseAdmin.from('images').delete().eq('project_id', id)
       await supabaseAdmin.from('project_members').delete().eq('project_id', id)
       
       // Force delete the project now
       const forceRes = await supabaseAdmin.from('projects').delete().eq('id', id)
       if (forceRes.error) throw forceRes.error
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
