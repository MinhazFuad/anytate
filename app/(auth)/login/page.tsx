'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { BoxSelect } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
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
    <div className="flex min-h-screen items-center justify-center bg-bg p-4 font-body relative overflow-hidden">
      
      {/* Absolute Header */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-end">
        <ThemeToggle />
      </div>

      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent-cyan-muted rounded-full blur-[100px] -z-10 opacity-60"></div>
      
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface/80 p-10 shadow-2xl backdrop-blur-xl flex flex-col items-center">
        
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-accent-cyan to-accent-magenta flex items-center justify-center mb-6 shadow-lg">
          <BoxSelect size={28} className="text-white" strokeWidth={2} />
        </div>
        
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-display font-bold tracking-tight text-text-primary mb-2">
            Welcome to AnyTate
          </h1>
          <p className="text-sm text-text-secondary font-display">
            Sign in to access your annotation projects, manage your teams, and sync your Drive.
          </p>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="group relative flex w-full items-center justify-center gap-3 rounded-full bg-surface-2 border border-border px-4 py-3.5 text-sm font-display font-semibold text-text-primary transition-all hover:bg-surface-hover hover:border-text-secondary hover:shadow-md active:scale-95 disabled:opacity-50"
        >
          {/* Google G Logo SVG */}
          <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          {loading ? 'Connecting to Google...' : 'Continue with Google'}
        </button>
        
        <p className="mt-8 text-xs text-text-tertiary text-center max-w-[300px]">
          By continuing, you grant AnyTate read-only access to your Google Drive to sync image folders.
        </p>
      </div>
    </div>
  )
}
