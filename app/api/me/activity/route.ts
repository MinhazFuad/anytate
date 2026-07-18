import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: activity, error } = await supabase
      .from('annotation_history')
      .select('*, annotations!inner(image_id, images!inner(file_name, project_id, projects!inner(name)))')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ activity })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
