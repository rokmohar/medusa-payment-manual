// Sources:
// - EPC: EPC069-12 v3.0 "Quick Response Code: Guidelines to Enable the Data Capture for the Initiation of a SCT"
//   https://www.europeanpaymentscouncil.eu/sites/default/files/kb/file/2022-09/EPC069-12%20v3.0%20Quick%20Response%20Code%20-%20Guidelines%20to%20Enable%20the%20Data%20Capture%20for%20the%20Initiation%20of%20an%20SCT_0.pdf
//   (BCD/002/1/SCT, BIC optional in 002, name 70, IBAN 34, "EUR" + 1..12 chars, purpose 4, RF reference 35 OR text 140,
//   LF separators, last populated element not followed by a separator).
// - UPN: ZBS "UPN QR tehnični standard v1.1" + "Struktura zapisa QR na obrazcu UPN QR" (priloga 7.3), from
//   https://www.zbs-giz.si/wp-content/uploads/2021/07/objava_dokumentacije_UPN_QR-2016-12-15.zip
//   (19 fields + checksum, each followed by LF; checksum = sum of strlen(field + '\n') for fields 1..19, 3 digits;
//   spec example sums to 252, asserted below). Model SI99 = "no reference" per ZBS SI/RF reference rules.
// - Validators: no online decoder accepts raw payload text, so payloads were cross-checked against independent
//   implementations run in a scratch dir (not repo deps): npm `upnqr` and `sepa-payment-qr-code`; see task-4 report.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildEpcPayload, buildQrPayload, buildUpnPayload, upnChecksum, type QrInput } from '../../src/lib/qr'

const input = (over: Partial<QrInput> = {}): QrInput => {
  return {
    account: {
      id: 'a1',
      recipient: 'Trgovina d.o.o.',
      address_1: 'Šubičeva 2',
      postal_code: '1000',
      city: 'Ljubljana',
      country_code: 'si',
      iban: 'SI56020360253863406',
      bic: 'LJBASI2X',
      bank_name: 'NLB',
      countries: [],
    },
    amount: 12.3,
    currency_code: 'eur',
    reference: 'SI12 123455',
    scheme: 'SI12',
    purpose_code: null,
    payer: { name: 'Janez Novak', street: 'Lepa cesta 10', city: '2000 Maribor' },
    ...over,
  }
}

test('EPC: non-EUR or missing account data -> null', () => {
  assert.equal(buildEpcPayload(input({ currency_code: 'usd' })), null)
  assert.equal(buildEpcPayload(input({ account: { ...input().account, iban: '' } })), null)
  assert.equal(buildEpcPayload(input({ account: { ...input().account, recipient: ' ' } })), null)
  assert.notEqual(buildEpcPayload(input({ currency_code: 'EUR' })), null)
})

test('EPC: header, amount, BIC, unstructured SI reference, trailing empty lines removed', () => {
  const lines = buildEpcPayload(input())!.split('\n')

  assert.deepEqual(lines, [
    'BCD',
    '002',
    '1',
    'SCT',
    'LJBASI2X',
    'Trgovina d.o.o.',
    'SI56020360253863406',
    'EUR12.30',
    '',
    '',
    'SI12123455',
  ])

  const noBic = buildEpcPayload(input({ account: { ...input().account, bic: null }, reference: null }))!
  assert.equal(noBic, 'BCD\n002\n1\nSCT\n\nTrgovina d.o.o.\nSI56020360253863406\nEUR12.30')
})

test('EPC: name truncated to 70', () => {
  const lines = buildEpcPayload(input({ account: { ...input().account, recipient: 'x'.repeat(80) } }))!.split('\n')
  assert.equal(lines[5], 'x'.repeat(70))
})

test('EPC: RF goes to structured line, other schemes to unstructured', () => {
  const rf = buildEpcPayload(input({ scheme: 'RF', reference: 'RF18539007547034' }))!.split('\n')
  assert.equal(rf.length, 10)
  assert.equal(rf[9], 'RF18539007547034')

  const free = buildEpcPayload(input({ scheme: 'none', reference: 'Order 42', purpose_code: 'GDDS' }))!.split('\n')
  assert.equal(free[8], 'GDDS')
  assert.equal(free[9], '')
  assert.equal(free[10], 'Order 42')
})

test('UPN: non-EUR or missing account data -> null', () => {
  assert.equal(buildUpnPayload(input({ currency_code: 'usd' })), null)
  assert.equal(buildUpnPayload(input({ account: { ...input().account, iban: '' } })), null)
  assert.notEqual(buildUpnPayload(input({ currency_code: 'EUR' })), null)
})

test('UPN: checksum formula matches the ZBS spec example (252)', () => {
  const fields = [
    'UPNQR',
    'SI56020170014356205',
    '',
    '',
    'SI00225268-32526-222',
    'Poljubno podjetje d.o.o.',
    'Lepa cesta 10',
    '2000 Maribor',
    '00000126874',
    '11.07.2016',
    'X',
    'CPYR',
    'Plačilo računa 18/2016.',
    '',
    'SI56020360253863406',
    'SI081236-17-345679',
    'Združenje bank Slovenije - GIZ',
    'Šubičeva 2',
    '1000 Ljubljana',
  ]
  assert.equal(upnChecksum(fields), '252')
})

test('UPN: full payload', () => {
  const payload = buildUpnPayload(input())!
  const lines = payload.split('\n')

  assert.ok(payload.endsWith('\n'))
  assert.equal(lines.length, 21) // 20 fields, each followed by LF
  assert.deepEqual(lines.slice(0, 19), [
    'UPNQR',
    '',
    '',
    '',
    '',
    'Janez Novak',
    'Lepa cesta 10',
    '2000 Maribor',
    '00000001230',
    '',
    '',
    'OTHR',
    'SI12 123455',
    '',
    'SI56020360253863406',
    'SI12123455',
    'Trgovina d.o.o.',
    'Šubičeva 2', // diacritics kept; consumers encode as ISO-8859-2 with ECI
    '1000 Ljubljana',
  ])
  assert.match(lines[19]!, /^\d{3}$/)
  assert.equal(Number(lines[19]), [...payload].length - 4)
})

test('UPN: truncation, purpose code, no payer, no reference', () => {
  const lines = buildUpnPayload(
    input({
      account: { ...input().account, recipient: 'č'.repeat(70) },
      payer: null,
      reference: null,
      scheme: 'none',
      purpose_code: 'GDSV',
    }),
  )!.split('\n')

  assert.equal(lines.length, 21)
  assert.equal(lines[5], '')
  assert.equal(lines[11], 'GDSV')
  assert.equal(lines[12], '')
  assert.equal(lines[15], 'SI99')
  assert.equal(lines[16], 'č'.repeat(33))
})

test('UPN/EPC: control characters in text fields cannot add lines', () => {
  const payload = buildUpnPayload(input({ payer: { name: 'Janez\r\nNovak', street: 'Lepa\tcesta  10', city: null } }))!
  const lines = payload.split('\n')

  assert.equal(lines.length, 21)
  assert.equal(lines[5], 'Janez Novak')
  assert.equal(lines[6], 'Lepa cesta 10')
  assert.equal(lines[8], '00000001230')
  assert.equal(Number(lines[19]), [...payload].length - 4)

  const epc = buildEpcPayload(input({ account: { ...input().account, recipient: 'Trgovina\nd.o.o.' } }))!.split('\n')
  assert.equal(epc.length, 11)
  assert.equal(epc[5], 'Trgovina d.o.o.')
})

test('UPN: NFD input is normalised to NFC before counting', () => {
  const payload = buildUpnPayload(input({ account: { ...input().account, recipient: 'Trgovina c\u030C' } }))!
  const lines = payload.split('\n')

  assert.equal(lines[16], 'Trgovina č')
  assert.equal(Number(lines[19]), [...payload].length - 4)
})

test('buildQrPayload dispatches by type', () => {
  assert.equal(buildQrPayload('none', input()), null)
  assert.equal(buildQrPayload('epc', input()), buildEpcPayload(input()))
  assert.equal(buildQrPayload('upn', input()), buildUpnPayload(input()))
})

test('UPN: recipient city line is postal code and city, blanks skipped, cut to 33', () => {
  const cityLine = (o: Partial<QrInput['account']>) => {
    return buildUpnPayload(input({ account: { ...input().account, ...o } }))!.split('\n')[18]
  }

  assert.equal(cityLine({}), '1000 Ljubljana')
  assert.equal(cityLine({ postal_code: null }), 'Ljubljana')
  assert.equal(cityLine({ city: null }), '1000')
  assert.equal(cityLine({ postal_code: null, city: null }), '')
  assert.equal(cityLine({ city: 'x'.repeat(40) }), `1000 ${'x'.repeat(28)}`)
})
