import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifyOwner(supabase: Awaited<ReturnType<typeof createServerClient>>, projectId: string, userId: string) {
  const { data: member } = await supabase.from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single()
  return member?.role === 'owner'
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params;
    if (!(await verifyOwner(supabase, id, user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: invites, error } = await supabase
      .from('project_invites')
      .select('*')
      .eq('project_id', id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ invites })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params;
    if (!(await verifyOwner(supabase, id, user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { email, role } = await request.json()
    if (!email || !role) return NextResponse.json({ error: 'Missing email or role' }, { status: 400 })

    const { data: invite, error } = await supabase
      .from('project_invites')
      .insert({
        project_id: id,
        invited_email: email,
        role,
        invited_by: user.id,
        status: 'pending',
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ invite })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params;
    if (!(await verifyOwner(supabase, id, user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const inviteId = searchParams.get('inviteId')
    if (!inviteId) return NextResponse.json({ error: 'Missing inviteId' }, { status: 400 })

    const { error } = await supabase
      .from('project_invites')
      .delete()
      .eq('id', inviteId)
      .eq('project_id', id)

    if (error) throw error

    return NextResponse.json({ success: true })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
