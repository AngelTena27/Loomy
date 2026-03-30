import { createFileRoute } from '@tanstack/react-router'
import { drizzle } from 'drizzle-orm/node-postgres'
import { whatsappInstances, whatsappMessages, contacts } from '../../../db/schema'
import { eq, and } from 'drizzle-orm'

function getDb() {
  return drizzle(process.env.DATABASE_URL!)
}

export const Route = createFileRoute('/api/webhooks/whatsapp')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json() as Record<string, unknown>
          const eventType = body?.event as string | undefined
          const instanceName = body?.instance as string | undefined

          if (!eventType || !instanceName) {
            return new Response('ok', { status: 200 })
          }

          const db = getDb()

          // QR code received
          if (eventType === 'qrcode.updated') {
            const qrBase64 = (body?.data as Record<string, unknown>)?.qrcode as Record<string, unknown>
            const base64 = qrBase64?.base64 as string | undefined
            if (base64) {
              await db.update(whatsappInstances)
                .set({ qr_code: base64, status: 'connecting', updated_at: new Date() })
                .where(eq(whatsappInstances.instance_name, instanceName))
            }
            return new Response('ok', { status: 200 })
          }

          // Connection state change
          if (eventType === 'connection.update') {
            const state = (body?.data as Record<string, unknown>)?.state as string | undefined
            if (state === 'open') {
              await db.update(whatsappInstances)
                .set({ status: 'connected', qr_code: null, updated_at: new Date() })
                .where(eq(whatsappInstances.instance_name, instanceName))
            } else if (state === 'close') {
              await db.update(whatsappInstances)
                .set({ status: 'disconnected', qr_code: null, updated_at: new Date() })
                .where(eq(whatsappInstances.instance_name, instanceName))
            }
            return new Response('ok', { status: 200 })
          }

          // Incoming WhatsApp message
          if (eventType === 'messages.upsert') {
            const data = body?.data as Record<string, unknown> | undefined
            const messages = data?.messages as Array<Record<string, unknown>> | undefined
            const message = messages?.[0]
            const key = message?.key as Record<string, unknown> | undefined
            if (message && key?.fromMe !== true) {
              const from = (key?.remoteJid as string | undefined)?.replace('@s.whatsapp.net', '') ?? ''
              const msgContent = message?.message as Record<string, unknown> | undefined
              const content = (msgContent?.conversation ?? (msgContent?.extendedTextMessage as Record<string, unknown> | undefined)?.text ?? '') as string
              const waMessageId = (key?.id as string | undefined) ?? ''

              if (from && content) {
                const [instance] = await db.select().from(whatsappInstances)
                  .where(eq(whatsappInstances.instance_name, instanceName)).limit(1)

                if (instance) {
                  const [contact] = await db.select().from(contacts)
                    .where(and(
                      eq(contacts.workspace_id, instance.workspace_id),
                      eq(contacts.phone, from)
                    )).limit(1)

                  await db.insert(whatsappMessages).values({
                    workspace_id: instance.workspace_id,
                    instance_id: instance.id,
                    contact_id: contact?.id ?? null,
                    direction: 'inbound',
                    content,
                    wa_message_id: waMessageId,
                    status: 'delivered',
                  })
                }
              }
            }
            return new Response('ok', { status: 200 })
          }

          return new Response('ok', { status: 200 })
        } catch (err) {
          console.error('WhatsApp webhook error:', err)
          return new Response('ok', { status: 200 })
        }
      },
    },
  },
})
