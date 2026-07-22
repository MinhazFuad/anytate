import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 })
    }

    // 1. Try DB verification via RPC function
    try {
      const { data: dbAdmin, error: rpcError } = await supabaseAdmin.rpc('verify_admin_credentials', {
        p_username: username.trim(),
        p_password: password
      })

      if (!rpcError && dbAdmin && dbAdmin.length > 0) {
        const adminUser = dbAdmin[0]
        const response = NextResponse.json({ success: true, user: adminUser })
        response.cookies.set('admin_token', adminUser.id, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/'
        })
        return response
      }
    } catch (e) {
      // RPC might not exist yet in DB if SQL migration hasn't been executed
    }

    // 2. Fallback check for initial admin credentials (Minhaze / Fuad#219)
    if (username.trim().toLowerCase() === 'minhaze' && password === 'Fuad#219') {
      const response = NextResponse.json({ success: true, user: { username: 'Minhaze', role: 'superadmin' } })
      response.cookies.set('admin_token', 'admin_fallback_session', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
      })
      return response
    }

    return NextResponse.json({ error: 'Invalid admin credentials' }, { status: 401 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
