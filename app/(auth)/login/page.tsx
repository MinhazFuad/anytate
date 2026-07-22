'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Shield, Lock, X } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import TypewriterWord from '@/components/TypewriterWord'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  
  // Admin Login Modal State
  const [showAdminModal, setShowAdminModal] = useState(false)
  const [adminUsername, setAdminUsername] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminError, setAdminError] = useState('')

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

  const handleAdminAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdminError('')

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: adminUsername,
          password: adminPassword
        })
      })

      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        throw new Error('Server returned invalid response format')
      }

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Authentication failed')

      sessionStorage.setItem('admin_session', 'true')
      toast.success('Admin authentication verified')
      router.push('/admin')
    } catch (err: any) {
      setAdminError(err.message)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4 font-body relative overflow-hidden">
      
      {/* Absolute Header with Back to Home & Theme Toggle */}
      <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between z-10">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-xs font-display font-medium text-text-secondary hover:text-text-primary transition-colors duration-150 ease-out"
        >
          <ArrowLeft size={16} strokeWidth={1.5} /> Back to Home
        </Link>
        <ThemeToggle />
      </div>

      {/* Card */}
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-10 shadow-[0_8px_24px_var(--shadow-color)] flex flex-col items-center relative">
        
        {/* Header Anytate Logo with Typewriter Effect */}
        <Link 
          href="/" 
          className="font-display font-bold tracking-[0.25em] uppercase text-2xl mb-6"
        >
          <TypewriterWord words={['ANNOTATE', 'ANYTATE']} />
        </Link>
        
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-display font-bold tracking-tight text-text-primary mb-2">
            Welcome to AnyTate
          </h1>
          <p className="text-sm text-text-secondary font-display leading-relaxed">
            Sign in to access your annotation projects, manage your teams, and sync your Drive.
          </p>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="group relative flex w-full h-9 items-center justify-center gap-3 rounded border border-border bg-surface-2 px-4 text-sm font-display font-semibold text-text-primary transition-colors duration-150 ease-out hover:bg-surface-hover hover:border-text-secondary active:scale-[0.98] disabled:opacity-50"
        >
          {/* Google G Logo SVG */}
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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

        {/* Discreet Admin Login Trigger */}
        <button
          type="button"
          onClick={() => setShowAdminModal(true)}
          className="mt-6 text-[11px] text-text-tertiary hover:text-text-secondary transition-colors font-data flex items-center gap-1 opacity-60 hover:opacity-100"
          title="Admin Control Access"
        >
          <Shield size={12} /> Admin Portal
        </button>
      </div>

      {/* Discreet Admin Login Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-bg/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-lg max-w-sm w-full p-6 shadow-2xl flex flex-col gap-4 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => {
                setShowAdminModal(false)
                setAdminError('')
              }}
              className="absolute top-4 right-4 text-text-tertiary hover:text-text-primary"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-2 text-accent-cyan">
              <Lock size={18} />
              <h3 className="font-display font-semibold text-base text-text-primary">Admin Access Verification</h3>
            </div>

            <form onSubmit={handleAdminAuthSubmit} className="flex flex-col gap-3">
              {adminError && (
                <div className="text-xs text-accent-red bg-accent-red/10 border border-accent-red/20 p-2 rounded">
                  {adminError}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-display uppercase tracking-wider text-text-secondary">Username</label>
                <input
                  type="text"
                  value={adminUsername}
                  onChange={e => setAdminUsername(e.target.value)}
                  placeholder="Admin Username"
                  className="bg-surface-2 border border-border rounded px-3 py-2 text-xs font-body text-text-primary focus:border-accent-cyan outline-none"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-display uppercase tracking-wider text-text-secondary">Password</label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  placeholder="Admin Password"
                  className="bg-surface-2 border border-border rounded px-3 py-2 text-xs font-body text-text-primary focus:border-accent-cyan outline-none"
                />
              </div>

              <button
                type="submit"
                className="mt-2 w-full py-2 bg-accent-cyan text-bg rounded text-xs font-display font-medium hover:bg-accent-cyan-hover transition-colors"
              >
                Authenticate & Enter Portal
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

