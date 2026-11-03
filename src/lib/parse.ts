import { MedusaError } from '@medusajs/framework/utils'
import { z } from 'zod'

/** One line per zod issue: `path: message`, joined with "; ". */
export const formatIssues = (error: z.ZodError): string => {
  return error.issues
    .map((i) => {
      return `${i.path.join('.') || '(root)'}: ${i.message}`
    })
    .join('; ')
}

// Validates a loosely typed row (query.graph, DML) at the boundary; a malformed row is a bug, never coerced.
export const parseRow = <T extends z.ZodType>(schema: T, row: unknown, label: string): z.output<T> => {
  const result = schema.safeParse(row)

  if (!result.success) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `Malformed ${label}: ${formatIssues(result.error)}`)
  }

  return result.data
}

// Totals and quantities come back as numbers or BigNumber instances (valueOf → number).
export const numeric = z
  .custom<unknown>((v) => {
    return v !== undefined && v !== null
  }, 'number is required')
  .transform(Number)
  .pipe(z.number())
