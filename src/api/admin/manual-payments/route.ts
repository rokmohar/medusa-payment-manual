import type { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { type AdminManualProvider, loadManualProviders } from '../../../lib/providers'

export type AdminProvidersResponse = { providers: AdminManualProvider[] }

// Sorted by rank.
export async function GET(req: MedusaRequest, res: MedusaResponse<AdminProvidersResponse>) {
  res.json({ providers: await loadManualProviders(req.scope) })
}
