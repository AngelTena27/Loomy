import { EvolutionProvider } from './evolution'
import type { WhatsAppProvider } from './types'

export function getWhatsAppProvider(): WhatsAppProvider {
  return new EvolutionProvider()
}

export type { WhatsAppProvider, QRData, InstanceStatus, IncomingMessage } from './types'
