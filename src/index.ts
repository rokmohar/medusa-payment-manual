import { ModuleProvider, Modules } from '@medusajs/utils'
import { ManualProviderService } from './services'

const services = [ManualProviderService]

export default ModuleProvider(Modules.PAYMENT, {
  services,
})
