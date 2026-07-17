import { NextResponse } from 'next/server'
import { getDriveAccessToken } from '@/lib/drive'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const parentId = searchParams.get('parentId') || 'root'

  try {
    const accessToken = await getDriveAccessToken()
    
    // Call Drive API to list folders only
    const query = `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    const driveUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&orderBy=name&pageSize=1000`

    const response = await fetch(driveUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
       const errorText = await response.text()
       return NextResponse.json({ error: 'Drive API error', details: errorText }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json({ folders: data.files })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
