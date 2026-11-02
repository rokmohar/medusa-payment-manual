import { referenceForQr } from './reference'
import type { BankAccount, QrType, ReferenceScheme } from './types'

export type QrInput = {
  account: BankAccount
  amount: number // major units
  currency_code: string
  reference: string | null // display form from buildReference
  scheme: ReferenceScheme
  purpose_code: string | null
  payer: { name: string | null; street: string | null; city: string | null } | null
}

const MAX_CENTS = 99_999_999_999 // 999 999 999.99, the limit of both formats

/** NFC, control characters (CR/LF would shift fields) and runs of whitespace to one space, trim, cut to `max` code points. */
const fit = (value: string | null | undefined, max: number): string => {
  const clean = (value ?? '')
    .normalize('NFC')
    .replace(/[\p{Cc}\s]+/gu, ' ')
    .trim()

  return [...clean].slice(0, max).join('').trim()
}

/** Amount in cents, or null when the payload can't be built (non-EUR, bad amount, incomplete account). */
const payableCents = (i: QrInput): number | null => {
  const cents = Math.round(i.amount * 100)

  if (
    i.currency_code.toLowerCase() !== 'eur' ||
    !Number.isFinite(cents) ||
    cents < 0 ||
    cents > MAX_CENTS ||
    !i.account.recipient.trim() ||
    !i.account.iban.trim()
  ) {
    return null
  }

  return cents
}

const purposeCode = (code: string | null): string | null => {
  return code && /^[A-Z]{4}$/.test(code) ? code : null
}

/** EPC069-12 v3.0, version 002, UTF-8. */
export const buildEpcPayload = (i: QrInput): string | null => {
  const cents = payableCents(i)

  if (cents === null) {
    return null
  }

  const reference = i.reference && (i.scheme === 'none' ? i.reference : referenceForQr(i.reference))
  const lines = [
    'BCD',
    '002',
    '1',
    'SCT',
    fit(i.account.bic, 11),
    fit(i.account.recipient, 70),
    fit(i.account.iban, 34),
    cents > 0 ? `EUR${(cents / 100).toFixed(2)}` : '', // amount is optional, min 0.01
    purposeCode(i.purpose_code) ?? '',
    i.scheme === 'RF' ? fit(reference, 35) : '', // structured: ISO 11649 RF only
    i.scheme === 'RF' ? '' : fit(reference, 140),
  ]

  // The last populated element is not followed by a separator.
  return lines.join('\n').replace(/\n+$/, '')
}

/** UPN QR field 20: sum of the lengths of fields 1-19, each counted with its LF separator. */
export const upnChecksum = (fields: string[]): string => {
  return String(
    fields.reduce((sum, f) => {
      return sum + [...f].length + 1
    }, 0),
  ).padStart(3, '0')
}

/**
 * ZBS UPN QR: 19 fields + checksum, each followed by LF. Text is returned as a JS string; encode it as ISO-8859-2
 * (QR version 15, byte mode, ECC M, ECI 000004).
 */
export const buildUpnPayload = (i: QrInput): string | null => {
  const cents = payableCents(i)

  if (cents === null) {
    return null
  }

  // Model + reference without spaces; SI99 = no reference (ZBS SI/RF reference rules).
  const reference = i.reference && i.scheme !== 'none' ? referenceForQr(i.reference) : 'SI99'
  const fields = [
    'UPNQR',
    '', // payer IBAN
    '', // deposit
    '', // withdrawal
    '', // payer reference
    fit(i.payer?.name, 33),
    fit(i.payer?.street, 33),
    fit(i.payer?.city, 33),
    String(cents).padStart(11, '0'),
    '', // payment date
    '', // urgent
    purposeCode(i.purpose_code) ?? 'OTHR',
    fit(i.reference, 42), // purpose text (mandatory on the form)
    '', // deadline
    fit(i.account.iban, 34),
    fit(reference, 26),
    fit(i.account.recipient, 33),
    fit(i.account.address_1, 33),
    fit([i.account.postal_code, i.account.city].filter(Boolean).join(' '), 33),
  ]

  return [...fields, upnChecksum(fields)]
    .map((f) => {
      return `${f}\n`
    })
    .join('')
}

export const buildQrPayload = (type: QrType, i: QrInput): string | null => {
  switch (type) {
    case 'epc':
      return buildEpcPayload(i)
    case 'upn':
      return buildUpnPayload(i)
    default:
      return null
  }
}
