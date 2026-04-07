import { createClient } from '@sanity/client'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const VALID_ACTIONS = ['overlay', 'visualization', 'screen'] as const
const VALID_OVERLAYS = ['none', 'sleep', 'closed'] as const
const VALID_VISUALIZATIONS = ['none', 'bubbles', 'geometric', 'waveforms'] as const

type Action = (typeof VALID_ACTIONS)[number]

const sanityClient = createClient({
  projectId: process.env.SANITY_PROJECT_ID || '7h05nytv',
  dataset: process.env.SANITY_DATASET || 'production',
  apiVersion: '2023-05-03',
  token: process.env.SANITY_WRITE_TOKEN,
  useCdn: false,
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS for preflight
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Auth check
  const apiKey = process.env.DISPLAY_API_KEY
  if (apiKey) {
    const authHeader = req.headers.authorization
    if (authHeader !== `Bearer ${apiKey}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  const { action, value } = req.body || {}

  if (!action || !VALID_ACTIONS.includes(action as Action)) {
    return res.status(400).json({
      error: `Invalid action. Valid actions: ${VALID_ACTIONS.join(', ')}`,
    })
  }

  // Validate value based on action
  if (action === 'overlay' && !VALID_OVERLAYS.includes(value)) {
    return res.status(400).json({
      error: `Invalid overlay value. Valid: ${VALID_OVERLAYS.join(', ')}`,
    })
  }

  if (action === 'visualization' && !VALID_VISUALIZATIONS.includes(value)) {
    return res.status(400).json({
      error: `Invalid visualization value. Valid: ${VALID_VISUALIZATIONS.join(', ')}`,
    })
  }

  if (action === 'screen' && (!value || typeof value !== 'string')) {
    return res.status(400).json({
      error: 'Screen action requires a value: triggerKey string or "primary"',
    })
  }

  try {
    await sanityClient.createOrReplace({
      _type: 'displayCommand',
      _id: 'displayCommand',
      action,
      value,
      nonce: crypto.randomUUID(),
    })

    return res.status(200).json({ ok: true, action, value })
  } catch (err) {
    console.error('Sanity write failed:', err)
    return res.status(500).json({ error: 'Failed to send display command' })
  }
}
