import { ModuleProvider, Modules } from '@medusajs/utils'
import { ManualProviderService } from './providers'

export default ModuleProvider(Modules.PAYMENT, {
  services: [ManualProviderService],
})
