'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { toast } from 'sonner'

export default function NotificationBell() {
  const [invites, setInvites] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const fetchData = async () => {
    // Fetch invites
    const invitesRes = await fetch('/api/me/invites')
    if (invitesRes.ok) {
      const data = await invitesRes.json()
      setInvites(data.invites || [])
    }
    // Fetch notifications
    const notifRes = await fetch('/api/me/notifications')
    if (notifRes.ok) {
      const data = await notifRes.json()
      setNotifications(data.notifications || [])
    }
  }

  useEffect(() => {
    fetchData() // fetch on mount
    // Re-fetch when user switches back to this tab — avoids polling when tab is hidden
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchData()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleAction = async (inviteId: string, action: 'accept' | 'reject') => {
    setLoading(true)
    try {
      const res = await fetch('/api/me/invites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId, action })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')

      toast.success(action === 'accept' ? 'Invite accepted! Project added to your dashboard.' : 'Invite declined.')
      setInvites(prev => prev.filter(i => i.id !== inviteId))

      if (action === 'accept') {
        // Refresh the page so the new project appears
        window.location.href = '/projects'
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkRead = async (notificationId: string, link: string | null) => {
    try {
      await fetch('/api/me/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId })
      })
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      if (link) {
        window.location.href = link
      }
    } catch (err) {
      console.error(err)
    }
  }

  const totalCount = invites.length + notifications.length

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="relative flex items-center justify-center w-9 h-9 rounded-md border border-border bg-surface hover:bg-surface-hover transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring"
        aria-label="Notifications"
      >
        <Bell size={18} strokeWidth={1.5} className="text-text-secondary" />
        {totalCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent-magenta text-[9px] font-data font-bold text-bg">
            {totalCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-lg border border-border bg-surface shadow-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-display font-semibold text-text-primary">Notifications</span>
            <span className="text-xs font-data text-text-tertiary">{totalCount} pending</span>
          </div>

          {totalCount === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-text-tertiary">
              No new notifications.
            </div>
          ) : (
            <div className="divide-y divide-border max-h-96 overflow-y-auto">
              {/* Notifications */}
              {notifications.map(n => (
                <div key={n.id} className="p-4 flex flex-col gap-2 hover:bg-surface-hover cursor-pointer transition-colors" onClick={() => handleMarkRead(n.id, n.link)}>
                  <p className="text-sm font-body text-text-primary">{n.message}</p>
                  <p className="text-[10px] text-text-tertiary font-data uppercase tracking-widest">{n.type.replace('_', ' ')}</p>
                </div>
              ))}
              {/* Invites */}
              {invites.map(invite => (
                <div key={invite.id} className="p-4 flex flex-col gap-2">
                  <div>
                    <p className="text-sm font-body text-text-primary font-medium">{invite.project_name}</p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Invited as <span className="capitalize font-semibold text-accent-cyan">{invite.role}</span>
                      {invite.invited_by_username ? ` by @${invite.invited_by_username}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={loading}
                      onClick={() => handleAction(invite.id, 'accept')}
                      className="flex-1 py-1.5 text-xs font-display font-semibold rounded-md bg-accent-cyan text-bg hover:bg-accent-cyan-hover transition-colors disabled:opacity-50"
                    >
                      Accept
                    </button>
                    <button
                      disabled={loading}
                      onClick={() => handleAction(invite.id, 'reject')}
                      className="flex-1 py-1.5 text-xs font-display font-medium rounded-md border border-border text-text-secondary hover:text-accent-red hover:border-accent-red transition-colors disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
