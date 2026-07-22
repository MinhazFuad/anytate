'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Shield, ArrowLeft, Users, Trash2, Search, Loader2, RefreshCw, KeyRound, AlertTriangle } from 'lucide-react'

export default function AdminDashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<any | null>(null)

  useEffect(() => {
    // Check admin authentication session
    const isAdmin = sessionStorage.getItem('admin_session') === 'true'
    if (!isAdmin) {
      toast.error('Unauthorized admin access. Please sign in.')
      router.replace('/login')
      return
    }

    loadUsers()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load users')
      setUsers(data.users || [])
    } catch (err: any) {
      toast.error('Admin API error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (user: any) => {
    setDeletingId(user.id)
    try {
      const res = await fetch(`/api/admin/users?userId=${user.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete user')
      
      toast.success(`User ${user.email} successfully deleted`)
      setUsers(prev => prev.filter(u => u.id !== user.id))
      setConfirmDeleteUser(null)
    } catch (err: any) {
      toast.error('Failed to delete user: ' + err.message)
    } finally {
      setDeletingId(null)
    }
  }

  const handleAdminSignOut = () => {
    sessionStorage.removeItem('admin_session')
    toast.success('Signed out of Admin Portal')
    router.replace('/login')
  }

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.id?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-bg text-text-primary font-body p-6 md:p-10 flex flex-col items-center">
      <div className="max-w-[1100px] w-full flex flex-col gap-6">
        
        {/* Admin Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface border border-border p-6 rounded-lg shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-accent-magenta/10 text-accent-magenta border border-accent-magenta/20">
              <Shield size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-text-primary flex items-center gap-2">
                Admin Control Portal
              </h1>
              <p className="text-xs text-text-secondary font-data mt-0.5">Logged in as Administrator (Minhaze)</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadUsers}
              disabled={loading}
              className="h-9 px-3 text-xs font-display font-medium bg-surface-2 border border-border hover:bg-surface-hover rounded flex items-center gap-2 transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Users
            </button>
            <button
              onClick={handleAdminSignOut}
              className="h-9 px-4 text-xs font-display font-medium bg-transparent border border-accent-red/50 text-accent-red hover:bg-accent-red/10 rounded transition-colors"
            >
              Exit Admin
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-surface border border-border p-5 rounded-lg">
            <div className="text-xs font-display uppercase tracking-wider text-text-secondary mb-1">Total System Users</div>
            <div className="text-3xl font-data font-bold text-text-primary">{users.length}</div>
          </div>
          <div className="bg-surface border border-border p-5 rounded-lg">
            <div className="text-xs font-display uppercase tracking-wider text-text-secondary mb-1">Active Projects Joined</div>
            <div className="text-3xl font-data font-bold text-accent-cyan">
              {users.reduce((acc, u) => acc + (u.memberships?.length || 0), 0)}
            </div>
          </div>
          <div className="bg-surface border border-border p-5 rounded-lg">
            <div className="text-xs font-display uppercase tracking-wider text-text-secondary mb-1">System Status</div>
            <div className="text-3xl font-data font-bold text-accent-green flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-accent-green animate-pulse" /> Operational
            </div>
          </div>
        </div>

        {/* Users Table Card */}
        <div className="bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
          
          <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-2">
            <div className="flex items-center gap-2 text-sm font-display font-semibold text-text-primary">
              <Users size={18} className="text-accent-cyan" /> User Accounts ({filteredUsers.length})
            </div>

            <div className="relative w-full sm:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search email, username, ID..."
                className="w-full bg-surface border border-border rounded pl-9 pr-4 py-1.5 text-xs font-body text-text-primary placeholder:text-text-tertiary focus:border-accent-cyan outline-none transition-colors"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center text-text-secondary gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-accent-cyan" />
              <span className="text-sm font-display">Fetching platform users...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-text-secondary text-sm font-body">
              No users found matching your search query.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface text-[11px] font-display uppercase tracking-wider text-text-secondary">
                    <th className="p-4">User</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Projects</th>
                    <th className="p-4">Joined At</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="hover:bg-surface-hover/50 transition-colors">
                      <td className="p-4 font-display font-medium text-text-primary">
                        <div className="flex flex-col">
                          <span>{u.username}</span>
                          <span className="text-[10px] font-data text-text-tertiary">{u.id}</span>
                        </div>
                      </td>
                      <td className="p-4 font-data text-text-secondary">{u.email}</td>
                      <td className="p-4">
                        {u.memberships && u.memberships.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {u.memberships.map((m: any, idx: number) => (
                              <span key={idx} className="text-[10px] font-data bg-surface-2 border border-border px-2 py-0.5 rounded text-text-primary">
                                {m.project?.name || 'Project'} ({m.role})
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-text-tertiary italic">No active projects</span>
                        )}
                      </td>
                      <td className="p-4 font-data text-xs text-text-tertiary">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => setConfirmDeleteUser(u)}
                          className="p-2 text-accent-red hover:bg-accent-red/10 rounded border border-transparent hover:border-accent-red/30 transition-colors"
                          title="Delete User"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Delete User Modal */}
      {confirmDeleteUser && (
        <div className="fixed inset-0 bg-bg/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-lg p-6 max-w-md w-full flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center gap-3 text-accent-red">
              <AlertTriangle size={24} />
              <h3 className="font-display font-semibold text-lg text-text-primary">Delete User Account</h3>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">
              Are you sure you want to delete user <span className="font-data font-semibold text-text-primary">{confirmDeleteUser.email}</span>? This will permanently wipe their account and project permissions.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmDeleteUser(null)}
                disabled={deletingId !== null}
                className="px-4 py-2 bg-transparent border border-border text-text-secondary rounded text-xs font-display font-medium hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteUser(confirmDeleteUser)}
                disabled={deletingId !== null}
                className="px-4 py-2 bg-accent-red text-bg hover:bg-accent-red/90 rounded text-xs font-display font-medium flex items-center gap-2"
              >
                {deletingId && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
