import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { image_id } = await request.json()
    if (!image_id) return NextResponse.json({ error: 'Missing image_id' }, { status: 400 })

    // 1. Get the annotation for this image
    const { data: annotation, error: annErr } = await supabase
      .from('annotations')
      .select('id, grounded_instances')
      .eq('image_id', image_id)
      .single()

    if (annErr || !annotation) {
      return NextResponse.json({ error: 'No annotation found for this image' }, { status: 404 })
    }

    // 2. Fetch the latest history event for this annotation
    const { data: historyEvent, error: histErr } = await supabase
      .from('annotation_history')
      .select('*')
      .eq('annotation_id', annotation.id)
      .order('id', { ascending: false })
      .limit(1)
      .single()

    if (histErr || !historyEvent) {
      return NextResponse.json({ error: 'No history to undo' }, { status: 400 })
    }

    // 3. Reverse the operation
    if (historyEvent.action_type === 'initial_save') {
      // If the last action was the initial save, undoing it means deleting the annotation
      // and marking the image as pending again.
      await supabase.from('annotations').delete().eq('id', annotation.id)
      await supabase.from('images').update({ status: 'pending' }).eq('id', image_id)
      
      // Delete the history row
      await supabase.from('annotation_history').delete().eq('id', historyEvent.id)
      
      return NextResponse.json({ success: true, action: 'deleted' })
    }

    if (historyEvent.action_type === 'edit_instances') {
      // Restore previous state
      const previousState = historyEvent.payload.previous || []
      
      await supabase.from('annotations').update({
        grounded_instances: previousState,
        updated_at: new Date().toISOString()
      }).eq('id', annotation.id)
      
      // Delete the history row (popping the stack)
      await supabase.from('annotation_history').delete().eq('id', historyEvent.id)
      
      return NextResponse.json({ success: true, action: 'reverted', restoredBoxes: previousState })
    }

    return NextResponse.json({ error: 'Unsupported action_type' }, { status: 400 })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
