'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import NotificationBell from './NotificationBell'
import { User } from 'lucide-react'
import ThemeToggle from './ThemeToggle'

export default function GlobalNavbar() {
  const pathname = usePathname()

  // Hide entirely on auth pages and landing page
  if (pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/auth')) return null

  // Hide on workspace and review queues as they have their own headers/back buttons
  const isWorkspace = pathname.match(/^\/projects\/[^/]+$/)
  const isReview = pathname.match(/^\/projects\/[^/]+\/review$/)
  if (isWorkspace || isReview) return null

  // Profile and sign out only visible in dashboard and project pages
  const isDashboardOrProject = pathname.startsWith('/projects')

  return (
    <header className="h-14 border-b border-border bg-surface px-6 flex items-center justify-between shrink-0 sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <Link href={pathname.startsWith('/projects') ? "/projects" : "/"} className="font-display font-bold text-accent-cyan tracking-widest uppercase text-sm hover:text-accent-cyan-hover transition-colors">
          Anytate
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <NotificationBell />
        
        {isDashboardOrProject && (
          <div className="flex items-center gap-3 ml-2 border-l border-border pl-3">
            <Link
              href="/profile"
              className="flex items-center justify-center w-8 h-8 rounded-md border border-border bg-surface hover:bg-surface-hover transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring"
              title="Profile"
            >
              <User size={16} strokeWidth={1.5} className="text-text-secondary" />
            </Link>
            <form action="/auth/signout" method="post">
              <button
                className="rounded-md border border-border px-3 py-1.5 text-xs font-display font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:border-accent-cyan hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring"
                type="submit"
              >
                Sign out
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  )
}
