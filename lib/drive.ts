import { createClient } from '@/lib/supabase/server'

export async function getDriveAccessToken() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: tokenData, error } = await supabase
    .from('drive_tokens')
    .select('provider_refresh_token')
    .eq('user_id', user.id)
    .single()

  if (error || !tokenData?.provider_refresh_token) {
    throw new Error('No Google Drive refresh token found. Please sign in again.')
  }

  // Use Google's OAuth2 token endpoint to refresh the access token
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '', 
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '', 
      refresh_token: tokenData.provider_refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to refresh Google Drive token')
  }

  const data = await response.json()
  return data.access_token as string
}
