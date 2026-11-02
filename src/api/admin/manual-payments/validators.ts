// Medusa's zod: validateAndTransformBody takes schemas of its own zod version.
import { z } from '@medusajs/framework/zod'

export const AdminRankManualProviders = z.object({ provider_ids: z.array(z.string()) })

export type AdminRankManualProvidersType = z.output<typeof AdminRankManualProviders>
