import { NextResponse } from 'next/server'
import { getDriveAccessToken } from '@/lib/drive'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const folderId = searchParams.get('folderId')

  if (!folderId) {
    return NextResponse.json({ error: 'Missing folderId' }, { status: 400 })
  }

  try {
    const accessToken = await getDriveAccessToken()
    
    // Call Drive API to list images
    const query = `'${folderId}' in parents and (mimeType contains 'image/') and trashed = false`
    const driveUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,imageMediaMetadata)&pageSize=1000`

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
    return NextResponse.json({ files: data.files })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
