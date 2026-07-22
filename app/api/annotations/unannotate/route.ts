import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Service role client bypasses RLS for deletions
const adminClient = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    // Use regular client to authenticate the user
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { image_id } = await request.json()
    if (!image_id) return NextResponse.json({ error: 'Missing image_id' }, { status: 400 })

    // 1. Verify the image exists and user has access via project membership
    const { data: image } = await adminClient
      .from('images')
      .select('id, project_id, status')
      .eq('id', image_id)
      .single()

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    const { data: member } = await adminClient
      .from('project_members')
      .select('role')
      .eq('project_id', image.project_id)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 })
    }

    // 2. Find the annotation record
    const { data: annotation } = await adminClient
      .from('annotations')
      .select('id')
      .eq('image_id', image_id)
      .maybeSingle()

    if (annotation) {
      // Delete history first (FK constraint)
      const { error: histErr } = await adminClient
        .from('annotation_history')
        .delete()
        .eq('annotation_id', annotation.id)
      if (histErr) console.error('History delete error:', histErr)

      // Delete any drafts for this image
      await adminClient
        .from('drafts')
        .delete()
        .eq('image_id', image_id)

      // Delete the annotation itself
      const { error: delErr } = await adminClient
        .from('annotations')
        .delete()
        .eq('id', annotation.id)

      if (delErr) throw delErr
    }

    // 3. Mark the image as pending again
    const { error: imgErr } = await adminClient
      .from('images')
      .update({ status: 'pending' })
      .eq('id', image_id)

    if (imgErr) throw imgErr

    return NextResponse.json({ success: true, action: 'unannotated' })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
