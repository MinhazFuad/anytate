import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const adminClient = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET: List all users with profile data and project memberships
export async function GET(request: Request) {
  try {
    const { data: usersData, error: usersErr } = await adminClient.auth.admin.listUsers()
    if (usersErr) throw usersErr

    const { data: profilesData } = await adminClient.from('profiles').select('*')
    const profilesMap = new Map((profilesData || []).map(p => [p.id, p.username]))

    const { data: membersData } = await adminClient
      .from('project_members')
      .select('user_id, role, projects(id, name)')

    const membersMap = new Map<string, any[]>()
    if (membersData) {
      membersData.forEach(m => {
        const list = membersMap.get(m.user_id) || []
        list.push({ role: m.role, project: m.projects })
        membersMap.set(m.user_id, list)
      })
    }

    const users = usersData.users.map(u => ({
      id: u.id,
      email: u.email,
      username: profilesMap.get(u.id) || u.user_metadata?.full_name || u.email?.split('@')[0] || 'User',
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      memberships: membersMap.get(u.id) || []
    }))

    return NextResponse.json({ users })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE: Delete a user by ID
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const { error } = await adminClient.auth.admin.deleteUser(userId)
    if (error) throw error

    // Also delete profile if present
    await adminClient.from('profiles').delete().eq('id', userId)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
