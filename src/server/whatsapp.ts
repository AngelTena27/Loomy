import { createServerFn } from '@tanstack/react-start'
import { getWebRequest } from 'vinxi/http'
import { db } from '../db'
import { whatsappInstances, whatsappMessages, contacts } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { getWhatsAppProvider } from '../lib/whatsapp'

function getAppOrigin(): string {
  try {
    const req = getWebRequest()
    return new URL(req.url).origin
  } catch {
    return process.env.APP_URL ?? ''
  }
}

function instanceName(workspaceId: string) {
  return `loomy-${workspaceId.slice(0, 8)}`
}

// ─── Connect ──────────────────────────────────────────────

export const connectWhatsAppFn = createServerFn({ method: 'POST' }).handler(async (ctx) => {
  const { workspaceId } = ctx.data as { workspaceId: string }
  const provider = getWhatsAppProvider()
  const name = instanceName(workspaceId)

  const [existing] = await db.select().from(whatsappInstances)
    .where(eq(whatsappInstances.workspace_id, workspaceId)).limit(1)

  if (existing?.status === 'connected') return { status: 'connected', qr: null }

  // Create instance if it doesn't exist
  if (!existing) {
    await provider.createInstance(name)
    await db.insert(whatsappInstances).values({
      workspace_id: workspaceId,
      instance_name: name,
      status: 'connecting',
      provider: 'evolution',
    })
  } else {
    // Logout to force QR regeneration
    await fetch(`${process.env.EVOLUTION_API_URL}/instance/logout/${name}`, {
      method: 'DELETE',
      headers: { apikey: process.env.EVOLUTION_API_KEY! },
    }).catch(() => null)
    await db.update(whatsappInstances)
      .set({ status: 'connecting', qr_code: null, updated_at: new Date() })
      .where(eq(whatsappInstances.workspace_id, workspaceId))
  }

  // Poll Evolution for QR (it appears within ~2s after create/logout)
  let qrBase64: string | null = null
  for (let i = 0; i < 8; i++) {
    await new Promise(r => setTimeout(r, 1500))
    const res = await fetch(`${process.env.EVOLUTION_API_URL}/instance/connect/${name}`, {
      headers: { apikey: process.env.EVOLUTION_API_KEY! },
    })
    const data = await res.json() as { base64?: string; count?: number }
    if (data.base64) { qrBase64 = data.base64; break }
  }

  if (qrBase64) {
    await db.update(whatsappInstances)
      .set({ qr_code: qrBase64, updated_at: new Date() })
      .where(eq(whatsappInstances.workspace_id, workspaceId))
  }

  // Register webhook so Evolution sends events (QR, connection, messages) to us
  const webhookUrl = `${getAppOrigin()}/api/webhooks/whatsapp`
  await provider.setWebhook(name, webhookUrl).catch(() => null)

  return { status: 'connecting', qr: qrBase64 }
})

// ─── Status + QR (polled by frontend every 3s) ────────────

export const getWhatsAppStatusFn = createServerFn({ method: 'GET' }).handler(async (ctx) => {
  const { workspaceId } = ctx.data as { workspaceId: string }

  const [instance] = await db.select().from(whatsappInstances)
    .where(eq(whatsappInstances.workspace_id, workspaceId)).limit(1)

  if (!instance) return null

  // If connecting and no QR yet, fetch directly from Evolution
  if (instance.status === 'connecting' && !instance.qr_code) {
    const provider = getWhatsAppProvider()
    const qr = await provider.getQR(instance.instance_name)
    if (qr?.base64) {
      await db.update(whatsappInstances)
        .set({ qr_code: qr.base64, updated_at: new Date() })
        .where(eq(whatsappInstances.workspace_id, workspaceId))
      return { ...instance, qr_code: qr.base64 }
    }
  }

  // If connecting, also check if now connected
  if (instance.status === 'connecting') {
    const provider = getWhatsAppProvider()
    const status = await provider.getStatus(instance.instance_name)
    if (status.status === 'connected') {
      await db.update(whatsappInstances)
        .set({ status: 'connected', qr_code: null, phone_number: status.phoneNumber ?? null, updated_at: new Date() })
        .where(eq(whatsappInstances.workspace_id, workspaceId))
      return { ...instance, status: 'connected', qr_code: null }
    }
  }

  return instance
})

// ─── Disconnect ───────────────────────────────────────────

export const disconnectWhatsAppFn = createServerFn({ method: 'POST' }).handler(async (ctx) => {
  const { workspaceId } = ctx.data as { workspaceId: string }
  const provider = getWhatsAppProvider()
  const name = instanceName(workspaceId)

  await provider.deleteInstance(name).catch(() => null)
  await db.update(whatsappInstances)
    .set({ status: 'disconnected', phone_number: null, qr_code: null, updated_at: new Date() })
    .where(eq(whatsappInstances.workspace_id, workspaceId))

  return { success: true }
})

// ─── Register Webhook (for already-connected instances) ───

export const registerWhatsAppWebhookFn = createServerFn({ method: 'POST' }).handler(async (ctx) => {
  const { workspaceId } = ctx.data as { workspaceId: string }
  const provider = getWhatsAppProvider()
  const name = instanceName(workspaceId)
  const webhookUrl = `${getAppOrigin()}/api/webhooks/whatsapp`
  await provider.setWebhook(name, webhookUrl)
  return { webhookUrl }
})

// ─── Send Message ─────────────────────────────────────────

export const sendWhatsAppMessageFn = createServerFn({ method: 'POST' }).handler(async (ctx) => {
  const { workspaceId, contactId, message } = ctx.data as {
    workspaceId: string
    contactId: string
    message: string
  }

  const [instance] = await db.select().from(whatsappInstances)
    .where(and(eq(whatsappInstances.workspace_id, workspaceId), eq(whatsappInstances.status, 'connected'))).limit(1)

  if (!instance) throw new Error('No hay una instancia de WhatsApp conectada')

  const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1)
  if (!contact?.phone) throw new Error('El contacto no tiene número de teléfono')

  // Strip everything non-numeric. Evolution API expects digits only with country code, e.g. 525619977523
  const phone = contact.phone.replace(/\D/g, '')
  if (!phone) throw new Error('El número de teléfono del contacto no es válido')

  const provider = getWhatsAppProvider()
  const waMessageId = await provider.sendMessage(instance.instance_name, phone, message)

  const [saved] = await db.insert(whatsappMessages).values({
    workspace_id: workspaceId,
    instance_id: instance.id,
    contact_id: contactId,
    direction: 'outbound',
    content: message,
    wa_message_id: waMessageId,
    status: 'sent',
  }).returning()

  return saved
})

// ─── Message History ──────────────────────────────────────

export const listWhatsAppMessagesFn = createServerFn({ method: 'GET' }).handler(async (ctx) => {
  const { contactId } = ctx.data as { contactId: string }

  const messages = await db.select().from(whatsappMessages)
    .where(eq(whatsappMessages.contact_id, contactId))
    .orderBy(whatsappMessages.created_at)

  return messages
})
