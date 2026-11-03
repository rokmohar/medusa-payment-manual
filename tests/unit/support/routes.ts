import type { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { ContainerRegistrationKeys } from '@medusajs/utils'

export function createRequest<TRequest extends MedusaRequest = MedusaRequest>(
  overrides: Partial<TRequest>,
  registrations: Record<string, unknown> = {},
): TRequest {
  const request = {
    filterableFields: {},
    ...overrides,
    scope: {
      resolve: <T>(key: string, resolveOptions?: { allowUnregistered?: boolean }): T => {
        if (!Object.hasOwn(registrations, key) && resolveOptions?.allowUnregistered !== true) {
          throw new Error(`Unexpected container resolution: ${key}`)
        }

        return registrations[key] as T
      },
    },
  }

  return request as TRequest
}

export function createResponse<T>(): { res: MedusaResponse<T>; payloads: T[] } {
  const payloads: T[] = []
  const response = {
    json: (payload: T): void => {
      payloads.push(payload)
    },
  }

  return { res: response as MedusaResponse<T>, payloads }
}

export const QUERY_KEY: string = ContainerRegistrationKeys.QUERY
