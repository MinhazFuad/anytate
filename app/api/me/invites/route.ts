import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Module-level singleton \u2014 instantiated once per serverless cold start, not per request
const adminClient = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // We use adminClient because the user is not yet a member of the project, 
    // so RLS on the `projects` table would normally block them from seeing the project name!
    const { data: invites, error } = await adminClient
      .from('project_invites')
      .select(`
        *,
        projects!inner(name)
      `)
      .eq('invited_email', user.email!)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!invites || invites.length === 0) {
      return NextResponse.json({ invites: [] })
    }

    // Fetch profiles for the inviters
    const inviterIds = [...new Set(invites.map(i => i.invited_by).filter(Boolean))]
    let profilesMap: Record<string, string> = {}
    
    if (inviterIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', inviterIds)
      
      if (profiles) {
        profilesMap = Object.fromEntries(profiles.map(p => [p.id, p.username]))
      }
    }

    const reshaped = invites.map((inv: any) => ({
      ...inv,
      project_name: inv.projects?.name || 'Unknown Project',
      invited_by_username: profilesMap[inv.invited_by] || null
    }))

    return NextResponse.json({ invites: reshaped })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { inviteId, action } = await request.json()

    if (!inviteId || !action) {
      return NextResponse.json({ error: 'Missing inviteId or action' }, { status: 400 })
    }

    if (action !== 'accept' && action !== 'reject') {
      return NextResponse.json({ error: 'Invalid action. Must be "accept" or "reject"' }, { status: 400 })
    }

    const { data: invite, error: fetchError } = await supabase
      .from('project_invites')
      .select('*')
      .eq('id', inviteId)
      .eq('invited_email', user.email!)
      .eq('status', 'pending')
      .single()

    if (fetchError || !invite) {
      return NextResponse.json({ error: 'Invite not found or already resolved' }, { status: 404 })
    }

    if (action === 'reject') {
      const { error } = await supabase
        .from('project_invites')
        .update({ status: 'rejected' })
        .eq('id', inviteId)
        .eq('invited_email', user.email!)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    const { error: updateError } = await supabase
      .from('project_invites')
      .update({ status: 'accepted' })
      .eq('id', inviteId)
      .eq('invited_email', user.email!)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    const { error: memberError } = await adminClient
      .from('project_members')
      .insert({
        project_id: invite.project_id,
        user_id: user.id,
        role: invite.role,
      })

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
