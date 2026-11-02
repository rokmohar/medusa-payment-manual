import { ModuleProviderExports } from '@medusajs/framework/types'
import { ModuleProvider, Modules } from '@medusajs/framework/utils'
import { ManualProviderService } from './service'

/**
 * Annotated explicitly so the emitted declaration references `@medusajs/framework/types`
 * (a declared peer dependency) rather than the inferred `@medusajs/types`, which this
 * package does not depend on directly.
 */
const manualPaymentProvider: ModuleProviderExports = ModuleProvider(Modules.PAYMENT, {
  services: [ManualProviderService],
})

export default manualPaymentProvider
