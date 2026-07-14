import { NextResponse } from 'next/server'
import { getDriveAccessToken } from '@/lib/drive'

export async function GET() {
  try {
    const accessToken = await getDriveAccessToken()
    return NextResponse.json({ accessToken })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }
}
