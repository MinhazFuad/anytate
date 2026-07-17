import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

// Use service role for admin operations to bypass RLS limitations on delete
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { action, versionId, projectId, newName, schemaType = 'taxonomy' } = await request.json()

    // 1. Verify user is project member
    const { data: member } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single()

    if (!member) return NextResponse.json({ error: 'Unauthorized for this project' }, { status: 403 })

    const tables = {
      versions: schemaType === 'taxonomy' ? 'taxonomy_versions' : 'scene_metadata_field_sets',
      classes: schemaType === 'taxonomy' ? 'taxonomy_classes' : 'scene_metadata_fields',
      fk_annotations: schemaType === 'taxonomy' ? 'taxonomy_version_id' : 'scene_metadata_field_set_id',
      fk_children: schemaType === 'taxonomy' ? 'taxonomy_version_id' : 'field_set_id'
    }

    if (action === 'set_active') {
      // Deactivate all versions
      await supabaseAdmin.from(tables.versions).update({ is_active: false }).eq('project_id', projectId)
      // Activate the selected one
      const { error } = await supabaseAdmin.from(tables.versions).update({ is_active: true }).eq('id', versionId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'rename') {
      const { error } = await supabaseAdmin.from(tables.versions).update({ version_name: newName || null }).eq('id', versionId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'delete') {
      // Ensure it has 0 annotations
      const { data: anns } = await supabaseAdmin.from('annotations').select('id').eq(tables.fk_annotations, versionId).limit(1)
      if (anns && anns.length > 0) {
        return NextResponse.json({ error: 'Cannot delete a version that has annotations linked to it.' }, { status: 400 })
      }
      
      // Ensure it is not the last active version
      const { data: v } = await supabaseAdmin.from(tables.versions).select('is_active').eq('id', versionId).single()
      if (v?.is_active) {
        // Find another version to make active first if possible, or just reject
        return NextResponse.json({ error: 'Cannot delete the active version. Set another version as active first.' }, { status: 400 })
      }

      // Delete children first (due to FK constraint)
      await supabaseAdmin.from(tables.classes).delete().eq(tables.fk_children, versionId)
      // Delete the version
      const { error } = await supabaseAdmin.from(tables.versions).delete().eq('id', versionId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
