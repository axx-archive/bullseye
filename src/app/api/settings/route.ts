import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { encrypt, decrypt } from '@/lib/encryption'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const settings = await db.userSettings.findUnique({
    where: { userId: user.id },
  })

  if (!settings || !settings.claudeApiKeyEncrypted || !settings.claudeApiKeyIv) {
    return NextResponse.json({ hasApiKey: false, maskedKey: null })
  }

  // Decrypt to get last 4 chars for masking
  const fullKey = decrypt(settings.claudeApiKeyEncrypted, settings.claudeApiKeyIv)
  const last4 = fullKey.slice(-4)
  const maskedKey = `sk-ant-...${last4}`

  return NextResponse.json({ hasApiKey: true, maskedKey })
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { claudeApiKey } = body

  if (!claudeApiKey || typeof claudeApiKey !== 'string') {
    return NextResponse.json({ error: 'claudeApiKey is required' }, { status: 400 })
  }

  if (!claudeApiKey.startsWith('sk-ant-')) {
    return NextResponse.json({ error: 'Invalid API key format. Key must start with sk-ant-' }, { status: 400 })
  }

  const { ciphertext, iv } = encrypt(claudeApiKey)

  await db.userSettings.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      claudeApiKeyEncrypted: ciphertext,
      claudeApiKeyIv: iv,
    },
    update: {
      claudeApiKeyEncrypted: ciphertext,
      claudeApiKeyIv: iv,
    },
  })

  const last4 = claudeApiKey.slice(-4)
  return NextResponse.json({ hasApiKey: true, maskedKey: `sk-ant-...${last4}` })
}

export async function DELETE() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const settings = await db.userSettings.findUnique({
    where: { userId: user.id },
  })

  if (!settings) {
    return NextResponse.json({ hasApiKey: false, maskedKey: null })
  }

  await db.userSettings.update({
    where: { userId: user.id },
    data: {
      claudeApiKeyEncrypted: null,
      claudeApiKeyIv: null,
    },
  })

  return NextResponse.json({ hasApiKey: false, maskedKey: null })
}
