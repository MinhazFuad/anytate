'use client'

import { createClient } from '@/lib/supabase/client'
import { LogIn } from 'lucide-react'

export default function LoginPage() {
  const handleLogin = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/drive.readonly',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
        redirectTo: `${window.location.origin}/auth/callback?next=/projects`,
      },
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-surface/50 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-text">
            Anytate
          </h1>
          <p className="mt-2 text-sm text-muted">
            General-Purpose FCOT Annotation Web App
          </p>
        </div>

        <button
          onClick={handleLogin}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-background transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <LogIn className="h-5 w-5" />
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
