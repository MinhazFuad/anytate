import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // verify membership (using admin client to bypass any RLS issues, since we securely have user.id)
    const { data: member, error: memberErr } = await supabaseAdmin.from('project_members')
      .select('role')
      .eq('project_id', id)
      .eq('user_id', user.id)
      .single()
      
    if (memberErr || !member) {
      console.error("Membership check failed:", memberErr)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: members, error: memErr } = await supabaseAdmin.from('project_members')
      .select('*')
      .eq('project_id', id)
      
    if (memErr) throw memErr

    const { data: usersData, error: listErr } = await supabaseAdmin.auth.admin.listUsers()
    if (listErr) throw listErr

    const userIds = members.map(m => m.user_id)
    const { data: profilesData } = await supabaseAdmin.from('profiles')
      .select('id, username')
      .in('id', userIds)

    const profilesMap = new Map(profilesData?.map(p => [p.id, p.username]) || [])

    const membersWithEmails = members.map((m: any) => {
      const u = usersData.users.find(u => u.id === m.user_id)
      const username = profilesMap.get(m.user_id) || u?.email?.split('@')[0] || 'Unknown User'
      return {
        ...m,
        email: u?.email || 'Unknown User',
        profiles: { username }
      }
    })

    return NextResponse.json({ members: membersWithEmails })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // verify ownership
    const { data: member, error: memberErr } = await supabaseAdmin.from('project_members')
      .select('role')
      .eq('project_id', id)
      .eq('user_id', user.id)
      .single()
      
    if (memberErr || !member || member.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { email, role } = await request.json()
    if (!email || !role) return NextResponse.json({ error: 'Missing email or role' }, { status: 400 })

    // Find the user by email using Admin API
    const { data: usersData, error: listErr } = await supabaseAdmin.auth.admin.listUsers()
    if (listErr) throw listErr

    const targetUser = usersData.users.find(u => u.email === email)
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found. They must log in to the app at least once before they can be invited.' }, { status: 404 })
    }

    // Insert into project_members
    const { error: insertErr } = await supabaseAdmin.from('project_members').upsert({
      project_id: id,
      user_id: targetUser.id,
      role: role
    }, { onConflict: 'project_id, user_id' })

    if (insertErr) throw insertErr

    return NextResponse.json({ success: true, user_id: targetUser.id })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
