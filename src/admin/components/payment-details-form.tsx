import { Input, Select, Textarea } from '@medusajs/ui'
import { QR_TYPE_LABELS, SCHEME_LABELS } from '../../lib/admin-format'
import { buildReference } from '../../lib/reference'
import type { QrType, ReferenceScheme } from '../../lib/types'
import { Field, type SectionProps } from './fields'

const SCHEMES: ReferenceScheme[] = ['none', 'SI00', 'SI12', 'RF']
const QR_TYPES: QrType[] = ['none', 'epc', 'upn']

const isScheme = (v: string): v is ReferenceScheme => {
  return SCHEMES.some((s) => {
    return s === v
  })
}
const isQrType = (v: string): v is QrType => {
  return QR_TYPES.some((s) => {
    return s === v
  })
}

export const PaymentDetailsForm = ({ value, onChange, referenceAndQr }: SectionProps & { referenceAndQr: boolean }) => {
  const example = buildReference(value.reference_template, value.reference_scheme, 1234)

  return (
    <>
      <Field
        label="Instructions"
        hint="Shown to the customer after the order is placed. Translate it with the section's Translate action."
      >
        {(id) => {
          return (
            <Textarea
              id={id}
              value={value.instructions ?? ''}
              onChange={(e) => {
                return onChange({ instructions: e.target.value || null })
              }}
            />
          )
        }}
      </Field>
      {referenceAndQr ? (
        <>
          <Field label="Reference Template" hint="Use {display_id} for the order number, e.g. 2024{display_id}.">
            {(id) => {
              return (
                <Input
                  id={id}
                  size="small"
                  value={value.reference_template ?? ''}
                  onChange={(e) => {
                    return onChange({ reference_template: e.target.value || null })
                  }}
                />
              )
            }}
          </Field>
          <Field
            label="Reference Scheme"
            hint={`Example for order #1234: ${example ?? 'no reference (template empty or invalid for this scheme)'}`}
          >
            {(id) => {
              return (
                <Select
                  size="small"
                  value={value.reference_scheme}
                  onValueChange={(reference_scheme) => {
                    if (isScheme(reference_scheme)) {
                      onChange({ reference_scheme })
                    }
                  }}
                >
                  <Select.Trigger id={id}>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    {SCHEMES.map((s) => {
                      return (
                        <Select.Item key={s} value={s}>
                          {SCHEME_LABELS[s]}
                        </Select.Item>
                      )
                    })}
                  </Select.Content>
                </Select>
              )
            }}
          </Field>
          <Field label="QR Code">
            {(id) => {
              return (
                <Select
                  size="small"
                  value={value.qr_type}
                  onValueChange={(qr_type) => {
                    if (isQrType(qr_type)) {
                      onChange({ qr_type })
                    }
                  }}
                >
                  <Select.Trigger id={id}>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    {QR_TYPES.map((s) => {
                      return (
                        <Select.Item key={s} value={s}>
                          {QR_TYPE_LABELS[s]}
                        </Select.Item>
                      )
                    })}
                  </Select.Content>
                </Select>
              )
            }}
          </Field>
          {value.qr_type === 'upn' ? (
            <Field label="UPN Purpose Code" hint="4 uppercase letters. Default: OTHR.">
              {(id) => {
                return (
                  <Input
                    id={id}
                    size="small"
                    maxLength={4}
                    value={value.upn_purpose_code ?? ''}
                    onChange={(e) => {
                      return onChange({ upn_purpose_code: e.target.value.toUpperCase() || null })
                    }}
                  />
                )
              }}
            </Field>
          ) : null}
        </>
      ) : null}
    </>
  )
}
