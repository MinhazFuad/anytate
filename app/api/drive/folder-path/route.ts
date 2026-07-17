import { NextResponse } from 'next/server'
import { getDriveAccessToken } from '@/lib/drive'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const folderId = searchParams.get('folderId')
  
  if (!folderId || folderId === 'unknown') {
     return NextResponse.json({ path: 'Legacy Import / Unknown Folder' })
  }

  try {
    const accessToken = await getDriveAccessToken()
    
    let currentId = folderId;
    let pathNames = [];
    
    // Safety break to prevent infinite loops
    let depth = 0;
    while (currentId && depth < 10) {
       const driveUrl = `https://www.googleapis.com/drive/v3/files/${currentId}?fields=id,name,parents`
       const response = await fetch(driveUrl, {
         headers: { Authorization: `Bearer ${accessToken}` }
       })
       
       if (!response.ok) {
          if (depth === 0) return NextResponse.json({ path: folderId })
          break;
       }
       
       const data = await response.json()
       
       pathNames.unshift(data.name)
       
       if (data.parents && data.parents.length > 0) {
          currentId = data.parents[0]
       } else {
          // It has no parents, meaning it's root
          if (pathNames[0] !== 'My Drive') {
             pathNames[0] = 'My Drive'
          }
          break;
       }
       depth++;
    }
    
    return NextResponse.json({ path: pathNames.join('/') })

  } catch (error: any) {
    return NextResponse.json({ path: folderId })
  }
}
