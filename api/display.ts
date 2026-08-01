import { createClient } from '@sanity/client'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isObservatoryConfigured } from './_lib/observatory'
import {
  HEARTBEAT_ACTION,
  handleHeartbeat,
  parseHeartbeat,
  type LivenessClient,
} from './_lib/displayLiveness'

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

  // Display liveness heartbeat (issue #6). Handled before the command path so
  // the remote-control surface below is untouched: `heartbeat` is not a valid
  // action, it never writes a displayCommand, and it cannot change what is on
  // screen.
  //
  // It is deliberately exempt from DISPLAY_API_KEY: the caller is the menu
  // board's own browser, which cannot hold a secret. The key exists to protect
  // commands that change the display; a heartbeat changes nothing. What it can
  // write is bounded instead — a strictly-validated opaque display id, a known
  // display route, and a hard cap on distinct displays per day.
  if (req.body?.action === HEARTBEAT_ACTION) {
    return handleHeartbeatRequest(req, res)
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

/**
 * Record one menu board's liveness heartbeat and, when due, emit the day's
 * roll-up to the Agent Observatory.
 *
 * Nothing in here can reach the display: it writes a `displayLiveness`
 * document, which is not a type the players listen to, and it never touches
 * `displayCommand`. Every failure below is swallowed and answered with 200 —
 * the board must never see telemetry as something to react to.
 */
async function handleHeartbeatRequest(req: VercelRequest, res: VercelResponse) {
  // Until OBSERVATORY_URL / OBSERVATORY_INGEST_TOKEN are provisioned this is a
  // complete no-op: no Sanity writes, no state accumulating for someone to
  // clean up later.
  if (!isObservatoryConfigured()) {
    return res.status(200).json({ ok: true, tracked: false, reason: 'observatory not configured' })
  }

  const parsed = parseHeartbeat(req.body)
  if (!parsed.value) {
    return res.status(400).json({ error: parsed.error })
  }

  try {
    const result = await handleHeartbeat({ client: sanityClient as LivenessClient }, parsed.value)
    return res.status(200).json({ ok: true, tracked: true, ...result })
  } catch (err) {
    console.error('Display heartbeat failed:', err)
    return res.status(200).json({ ok: true, tracked: false, reason: 'heartbeat error' })
  }
}
