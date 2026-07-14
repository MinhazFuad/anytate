'use client'

import { useState, useEffect } from 'react'

export default function NewProjectPage() {
  const [folderId, setFolderId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [files, setFiles] = useState<any[]>([])
  const [accessToken, setAccessToken] = useState('')

  const handleTestRead = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setFiles([])

    try {
      // 1. Get a fresh access token
      const tokenRes = await fetch('/api/drive/refresh')
      const tokenData = await tokenRes.json()
      
      if (!tokenRes.ok) {
        throw new Error(tokenData.error || 'Failed to get access token')
      }
      setAccessToken(tokenData.accessToken)

      // 2. List files in the folder
      const listRes = await fetch(`/api/drive/list?folderId=${encodeURIComponent(folderId)}`)
      const listData = await listRes.json()

      if (!listRes.ok) {
        throw new Error(listData.error || 'Failed to list files')
      }

      setFiles(listData.files)

    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-8 text-text">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-8 text-3xl font-bold">New Project (Read Path Test)</h1>
        
        <form onSubmit={handleTestRead} className="rounded-xl border border-white/10 bg-surface/50 p-6 shadow-lg backdrop-blur-xl">
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-muted">
              Google Drive Folder ID
            </label>
            <input
              type="text"
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              placeholder="e.g. 1a2b3c4d5e6f7g8h9i0j..."
              className="w-full rounded-lg border border-white/10 bg-background px-4 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Testing...' : 'Test Read Path'}
          </button>
        </form>

        {error && (
          <div className="mt-6 rounded-lg bg-warn/10 p-4 text-warn border border-warn/20">
            {error}
          </div>
        )}

        {files.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-4 text-xl font-semibold">Found {files.length} Images</h2>
            <div className="rounded-xl border border-white/10 bg-surface p-6 shadow-lg">
              <h3 className="mb-4 text-sm font-medium text-muted">First Image Preview (Direct from Drive)</h3>
              {/* Load the image directly from Google Drive using the access token */}
              <DriveImagePreview fileId={files[0].id} accessToken={accessToken} />
              
              <ul className="mt-8 max-h-60 overflow-y-auto rounded-lg border border-white/5 bg-background p-4 text-sm text-muted">
                {files.map(f => (
                  <li key={f.id} className="mb-1 truncate">{f.name}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function DriveImagePreview({ fileId, accessToken }: { fileId: string, accessToken: string }) {
  const [imgSrc, setImgSrc] = useState<string>('')
  const [error, setError] = useState('')

  useEffect(() => {
    // Fetch image bytes directly from browser, as mandated by the implementation plan
    // DO NOT route this through a Vercel API!
    const fetchImage = async () => {
      try {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        })
        if (!res.ok) throw new Error('Failed to fetch image bytes from Drive')
        
        const blob = await res.blob()
        const objectUrl = URL.createObjectURL(blob)
        setImgSrc(objectUrl)
      } catch (err: any) {
        setError(err.message)
      }
    }
    fetchImage()
  }, [])

  if (error) return <div className="text-warn text-sm">{error}</div>
  if (!imgSrc) return <div className="animate-pulse h-64 bg-white/5 rounded-lg"></div>

  return (
    <div className="relative inline-block border-2 border-accent/50 shadow-[0_0_28px_rgba(0,229,255,0.22)] rounded-xl overflow-hidden">
      {/* For milestone 2, we just render an img. Next milestone we port the canvas. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imgSrc} alt="Drive Preview" className="max-w-full max-h-[600px] block" />
    </div>
  )
}
