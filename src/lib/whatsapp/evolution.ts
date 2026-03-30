import type { WhatsAppProvider, QRData, InstanceStatus } from './types'

export class EvolutionProvider implements WhatsAppProvider {
  private baseUrl: string
  private apiKey: string

  constructor() {
    this.baseUrl = process.env.EVOLUTION_API_URL!.replace(/\/$/, '')
    this.apiKey = process.env.EVOLUTION_API_KEY!
  }

  private async request(method: string, path: string, body?: unknown) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Evolution API error ${res.status}: ${text}`)
    }
    return res.json()
  }

  async createInstance(instanceName: string): Promise<void> {
    await this.request('POST', '/instance/create', {
      instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    })
  }

  async getQR(instanceName: string): Promise<QRData | null> {
    try {
      const data = await this.request('GET', `/instance/connect/${instanceName}`)
      if (!data?.base64) return null
      return {
        base64: data.base64,
        code: data.code ?? '',
      }
    } catch {
      return null
    }
  }

  async getStatus(instanceName: string): Promise<InstanceStatus> {
    try {
      const data = await this.request('GET', `/instance/connectionState/${instanceName}`)
      const state = data?.instance?.state ?? 'close'
      const status = state === 'open' ? 'connected'
        : state === 'connecting' ? 'connecting'
        : 'disconnected'
      return {
        status,
        phoneNumber: data?.instance?.profileName ?? undefined,
      }
    } catch {
      return { status: 'disconnected' }
    }
  }

  async setWebhook(instanceName: string, url: string): Promise<void> {
    await this.request('POST', `/webhook/set/${instanceName}`, {
      webhook: {
        enabled: true,
        url,
        webhookByEvents: false,
        webhookBase64: false,
        events: ['QRCODE_UPDATED', 'CONNECTION_UPDATE', 'MESSAGES_UPSERT'],
      },
    })
  }

  async sendMessage(instanceName: string, to: string, message: string): Promise<string> {
    const data = await this.request('POST', `/message/sendText/${instanceName}`, {
      number: to,
      text: message,
    })
    return data?.key?.id ?? ''
  }

  async deleteInstance(instanceName: string): Promise<void> {
    await this.request('DELETE', `/instance/delete/${instanceName}`)
  }
}
