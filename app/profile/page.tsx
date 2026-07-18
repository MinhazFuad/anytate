'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import ThemeToggle from '@/components/ThemeToggle'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, Flag, Save, Edit } from 'lucide-react'
import { toast } from 'sonner'

const ACTION_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  initial_save: { label: 'Annotated', color: 'text-accent-cyan', icon: Save },
  edit_instances: { label: 'Edited annotation', color: 'text-accent-amber', icon: Edit },
  approve: { label: 'Approved', color: 'text-accent-green', icon: CheckCircle },
  flag: { label: 'Flagged', color: 'text-accent-magenta', icon: Flag },
}

export default function ProfilePage() {
  const supabase = createClient()
  const router = useRouter()

  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<{ username: string } | null>(null)
  const [username, setUsername] = useState('')
  const [saving, setSaving] = useState(false)
  const [activity, setActivity] = useState<any[]>([])
  const [loadingActivity, setLoadingActivity] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      setUser(user)

      const [profileRes, activityRes] = await Promise.all([
        fetch('/api/me/profile'),
        fetch('/api/me/activity')
      ])

      if (profileRes.ok) {
        const d = await profileRes.json()
        if (d.profile) {
          setProfile(d.profile)
          setUsername(d.profile.username)
        }
      }

      if (activityRes.ok) {
        const d = await activityRes.json()
        setActivity(d.activity || [])
      }
      setLoadingActivity(false)
    }
    load()
  }, [])

  const handleSaveUsername = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/me/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setProfile(data.profile)
      toast.success('Username saved!')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary p-8 font-body">
      <div className="max-w-[860px] mx-auto space-y-8">

        <div className="flex items-center justify-between">
          <Link href="/projects" className="text-text-secondary hover:text-text-primary text-sm font-display font-medium transition-colors flex items-center gap-2">
            <ArrowLeft size={18} strokeWidth={1.5} /> Back to Projects
          </Link>
          <ThemeToggle />
        </div>

        {/* Profile Header */}
        <div className="bg-surface border border-border rounded-lg p-8 flex items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-accent-cyan-muted border-2 border-accent-cyan flex items-center justify-center text-2xl font-display font-bold text-accent-cyan shrink-0">
            {(profile?.username?.[0] || user?.email?.[0] || '?').toUpperCase()}
          </div>
          <div>
            <div className="text-2xl font-display font-semibold text-text-primary">
              {profile ? `@${profile.username}` : 'No username set'}
            </div>
            <div className="text-sm text-text-secondary mt-1">{user?.email}</div>
          </div>
        </div>

        {/* Username Settings */}
        <div className="bg-surface border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-display font-semibold text-text-primary border-b border-border pb-3">Username</h2>
          <p className="text-sm text-text-secondary">
            Choose a unique username (3–20 characters, letters, numbers, underscores only). Other project members will see this.
          </p>
          <form onSubmit={handleSaveUsername} className="flex gap-3 items-end">
            <div className="flex-1">
              <div className="flex items-center bg-surface-2 border border-border rounded-md overflow-hidden focus-within:border-accent-cyan transition-colors">
                <span className="px-3 py-2.5 text-text-tertiary font-display text-sm select-none border-r border-border">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="your_username"
                  pattern="[a-zA-Z0-9_]{3,20}"
                  title="3–20 characters, letters, numbers, underscores only"
                  required
                  className="flex-1 px-3 py-2.5 bg-transparent text-sm font-body text-text-primary outline-none"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-accent-cyan hover:bg-accent-cyan-hover text-bg text-sm font-display font-medium rounded-md transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : profile ? 'Update' : 'Claim Username'}
            </button>
          </form>
        </div>

        {/* Activity Feed */}
        <div className="bg-surface border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-display font-semibold text-text-primary border-b border-border pb-3">Recent Activity</h2>

          {loadingActivity ? (
            <div className="text-sm text-text-tertiary py-4 text-center">Loading activity...</div>
          ) : activity.length === 0 ? (
            <div className="text-sm text-text-tertiary py-8 text-center">No activity yet. Start annotating!</div>
          ) : (
            <div className="relative">
              <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />
              <div className="flex flex-col gap-0">
                {activity.map((item: any, idx: number) => {
                  const meta = ACTION_LABELS[item.action_type] || { label: item.action_type, color: 'text-text-secondary', icon: Edit }
                  const Icon = meta.icon
                  const image = item.annotations?.images
                  const project = image?.projects
                  const date = new Date(item.created_at)

                  return (
                    <div key={item.id} className="flex gap-4 relative pb-5">
                      <div className={`relative z-10 w-9 h-9 rounded-full bg-surface-2 border-2 border-border flex items-center justify-center shrink-0 ${meta.color}`}>
                        <Icon size={15} strokeWidth={2} />
                      </div>
                      <div className="flex-1 pt-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className={`text-sm font-display font-semibold ${meta.color}`}>{meta.label}</span>
                            {image && (
                              <span className="text-sm text-text-secondary font-body"> — <span className="font-data text-text-primary">{image.file_name}</span></span>
                            )}
                          </div>
                          <span className="text-[11px] font-data text-text-tertiary whitespace-nowrap shrink-0">
                            {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {project && (
                          <Link
                            href={`/projects/${image.project_id}/dashboard`}
                            className="text-xs text-text-tertiary hover:text-accent-cyan transition-colors mt-0.5 block"
                          >
                            {project.name}
                          </Link>
                        )}
                        {item.action_type === 'flag' && item.payload?.notes && (
                          <p className="text-xs text-accent-magenta mt-1 font-body italic">Note: &quot;{item.payload.notes}&quot;</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
