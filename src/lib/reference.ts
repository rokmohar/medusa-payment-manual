import type { ReferenceScheme } from './types'

/** SI12 modulo 11: weights 2,3,4,... from the right; r = 11 - sum % 11; r >= 10 -> 0. */
export const si12CheckDigit = (digits: string): string => {
  if (!/^\d+$/.test(digits)) {
    throw new Error('SI12 body must be digits')
  }

  const sum = [...digits].reverse().reduce((acc, d, i) => {
    return acc + Number(d) * (i + 2)
  }, 0)
  const r = 11 - (sum % 11)

  return r >= 10 ? '0' : String(r)
}

/** ISO 11649: RF + 2 check digits + body (uppercase alphanumerics, spaces stripped). */
export const rfReference = (body: string): string => {
  const b = body.replace(/\s+/g, '').toUpperCase()

  if (!/^[A-Z0-9]{1,21}$/.test(b)) {
    throw new Error('RF body must be 1-21 alphanumerics')
  }

  const n = BigInt(
    [...`${b}RF00`]
      .map((c) => {
        return parseInt(c, 36)
      })
      .join(''),
  )

  return `RF${String(98n - (n % 97n)).padStart(2, '0')}${b}`
}

export const buildReference = (
  template: string | null,
  scheme: ReferenceScheme,
  display_id: number | string,
): string | null => {
  if (!template?.trim()) {
    return null
  }

  const body = template.replaceAll('{display_id}', String(display_id))

  switch (scheme) {
    case 'SI00': // UPN reference field: max 22 characters after the model, spaces removed
      return body.replace(/\s+/g, '').length <= 22 ? `SI00 ${body}` : null
    case 'SI12':
      return /^\d{1,11}$/.test(body) ? `SI12 ${body}${si12CheckDigit(body)}` : null
    case 'RF':
      return /^[A-Za-z0-9 ]*$/.test(body) && /^[A-Z0-9]{1,21}$/.test(body.replace(/\s+/g, '').toUpperCase())
        ? rfReference(body)
        : null
    default:
      return body
  }
}

export const referenceForQr = (reference: string): string => {
  return reference.replace(/\s+/g, '')
}

/** Scheme a frozen reference was built with, read back from its prefix. */
export const schemeOfReference = (reference: string | null): ReferenceScheme => {
  if (!reference) {
    return 'none'
  }

  if (reference.startsWith('SI00 ')) {
    return 'SI00'
  }

  if (reference.startsWith('SI12 ')) {
    return 'SI12'
  }

  return /^RF\d{2}/.test(reference) ? 'RF' : 'none'
}
