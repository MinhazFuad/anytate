'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import NotificationBell from './NotificationBell'
import { User } from 'lucide-react'
import ThemeToggle from './ThemeToggle'

export default function GlobalNavbar() {
  const pathname = usePathname()

  // Hide entirely on auth pages
  if (pathname.startsWith('/login') || pathname.startsWith('/auth')) return null

  // Hide on workspace and review queues as they have their own headers/back buttons
  const isWorkspace = pathname.match(/^\/projects\/[^/]+$/)
  const isReview = pathname.match(/^\/projects\/[^/]+\/review$/)
  if (isWorkspace || isReview) return null

  // Profile and sign out only visible in dashboard and project pages
  const isDashboardOrProject = pathname.startsWith('/projects')

  return (
    <header style={{ viewTransitionName: 'site-header' }} className="h-14 border-b border-border bg-surface px-6 flex items-center justify-between shrink-0 sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <Link href={pathname.startsWith('/projects') ? "/projects" : "/"} className="flex items-center gap-2.5 font-display font-bold text-accent-cyan tracking-widest uppercase text-sm hover:text-accent-cyan-hover transition-colors duration-150 ease-out">
          <img src="/logo.png" alt="AnyTate Logo" className="h-5 w-auto object-contain shrink-0" />
          <span>ANYTATE</span>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <NotificationBell />
        {pathname === '/' ? (
          <div className="flex items-center gap-3 ml-2 border-l border-border pl-3">
            <Link 
              href="/login" 
              className="h-9 flex items-center px-3 text-xs font-display font-medium text-text-secondary hover:text-text-primary transition-colors duration-150 ease-out uppercase tracking-wider"
            >
              Log in
            </Link>
            <Link 
              href="/login" 
              className="h-9 flex items-center px-3 text-xs font-display font-medium bg-accent-cyan text-bg rounded hover:bg-accent-cyan-hover transition-colors duration-150 ease-out active:scale-[0.98] uppercase tracking-wider"
            >
              Get Started
            </Link>
          </div>
        ) : isDashboardOrProject ? (
          <div className="flex items-center gap-3 ml-2 border-l border-border pl-3">
            <Link
              href="/profile"
              className="flex items-center justify-center w-8 h-8 rounded border border-border bg-surface hover:bg-surface-hover transition-colors duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring"
              title="Profile"
            >
              <User size={16} strokeWidth={1.5} className="text-text-secondary" />
            </Link>
            <form action="/auth/signout" method="post">
              <button
                className="h-9 rounded border border-border px-3 text-xs font-display font-medium text-text-secondary transition-colors duration-150 ease-out hover:bg-surface-hover hover:border-accent-cyan hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring"
                type="submit"
              >
                Sign out
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </header>
  )
}
