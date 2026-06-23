import { generateNbtStrings } from '@/lib/nbt'
import type {
  ExportedNBTGeneratorWorkerMessage,
  ExportedNBTGeneratorWorkerResponse,
} from '@/types/workers'

// Worker Message Handler
self.onmessage = (evt: MessageEvent<ExportedNBTGeneratorWorkerMessage>) => {
  const msg = evt.data
  if (msg.cmd === 'generate') {
    const result = generateNbtStrings(msg.data)
    self.postMessage({
      type: 'data',
      data: result,
    } satisfies ExportedNBTGeneratorWorkerResponse)
  }
}
