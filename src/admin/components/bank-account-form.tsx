import { Input, Select, Text } from '@medusajs/ui'
import { type Choice, withSelected } from '../../lib/choices'
import { ALL_COUNTRIES } from '../lib/countries'
import type { BankAccount } from '../../lib/types'
import { Field, MultiSelect } from './fields'

// randomUUID is missing outside secure contexts (admin over plain http)
const newId = (): string => {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export const newAccount = (): BankAccount => {
  return {
    id: newId(),
    recipient: '',
    address_1: null,
    postal_code: null,
    city: null,
    country_code: null,
    iban: '',
    bic: null,
    bank_name: null,
    countries: [],
  }
}

type TextKey = 'recipient' | 'address_1' | 'postal_code' | 'city' | 'iban' | 'bic' | 'bank_name'
type TextField = { key: TextKey; label: string }

const RECIPIENT_FIELDS: TextField[] = [
  { key: 'recipient', label: 'Recipient' },
  { key: 'address_1', label: 'Address' },
  { key: 'postal_code', label: 'Postal Code' },
  { key: 'city', label: 'City' },
]
const BANK_FIELDS: TextField[] = [
  { key: 'iban', label: 'IBAN' },
  { key: 'bic', label: 'BIC' },
  { key: 'bank_name', label: 'Bank Name' },
]
// Select items can't have an empty value; country codes are two letters, so this can't clash.
const NO_COUNTRY = 'none'

/** The default account has no countries; which account is default changes only through "Set As Default". */
export const BankAccountForm = ({
  value,
  onChange,
  countries,
  isDefault,
}: {
  value: BankAccount
  onChange: (next: BankAccount) => void
  countries: Choice[]
  isDefault: boolean
}) => {
  const textField = (f: TextField) => {
    return (
      <Field key={f.key} label={f.label}>
        {(id) => {
          return (
            <Input
              id={id}
              size="small"
              value={value[f.key] ?? ''}
              onChange={(e) => {
                const text = e.target.value

                // recipient and IBAN are required strings; the rest are stored as null when empty
                onChange({
                  ...value,
                  [f.key]: f.key === 'recipient' || f.key === 'iban' ? text : text || null,
                })
              }}
            />
          )
        }}
      </Field>
    )
  }

  return (
    <>
      {RECIPIENT_FIELDS.map(textField)}
      <Field label="Country" hint="The recipient's country.">
        {(id) => {
          return (
            <Select
              size="small"
              value={value.country_code ?? NO_COUNTRY}
              onValueChange={(code) => {
                onChange({ ...value, country_code: code === NO_COUNTRY ? null : code })
              }}
            >
              <Select.Trigger id={id}>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value={NO_COUNTRY}>None</Select.Item>
                {withSelected(ALL_COUNTRIES, value.country_code ? [value.country_code] : []).map((c) => {
                  return (
                    <Select.Item key={c.code} value={c.code}>
                      {c.label}
                    </Select.Item>
                  )
                })}
              </Select.Content>
            </Select>
          )
        }}
      </Field>
      {BANK_FIELDS.map(textField)}
      {isDefault ? (
        <Field label="Countries">
          <Text size="small" className="text-ui-fg-subtle">
            This is the default account, used for all countries without their own account. To make another account the
            default, use Set As Default in its menu.
          </Text>
        </Field>
      ) : (
        <Field label="Countries" hint="Customers shipping to these countries see this account.">
          <MultiSelect
            label="countries"
            choices={countries}
            selected={value.countries}
            onChange={(next) => {
              return onChange({ ...value, countries: next })
            }}
          />
        </Field>
      )}
    </>
  )
}
