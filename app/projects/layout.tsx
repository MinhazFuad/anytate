import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ProjectsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if they have set up a username (completed onboarding)
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.username) {
    redirect('/onboarding')
  }

  return <>{children}</>
}
