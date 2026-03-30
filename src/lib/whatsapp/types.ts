export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'
export type MessageDirection = 'inbound' | 'outbound'

export interface QRData {
  base64: string
  code: string
}

export interface InstanceStatus {
  status: ConnectionStatus
  phoneNumber?: string
}

export interface IncomingMessage {
  waMessageId: string
  from: string       // phone number with country code e.g. "521234567890"
  content: string
  timestamp: number
}

export interface WhatsAppProvider {
  createInstance(instanceName: string): Promise<void>
  getQR(instanceName: string): Promise<QRData | null>
  getStatus(instanceName: string): Promise<InstanceStatus>
  setWebhook(instanceName: string, url: string): Promise<void>
  sendMessage(instanceName: string, to: string, message: string): Promise<string>
  deleteInstance(instanceName: string): Promise<void>
}
