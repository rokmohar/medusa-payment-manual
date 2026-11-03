import { Input, Select } from '@medusajs/ui'
import type { RuleMode } from '../../lib/types'
import type { Choices } from '../lib/queries'
import { type Choice, Field, MultiSelect, type SectionProps } from './fields'

const MODES: RuleMode[] = ['all', 'include', 'exclude']
const MODE_LABELS: Record<RuleMode, string> = { all: 'All', include: 'Only Selected', exclude: 'All Except Selected' }

const isMode = (v: string): v is RuleMode => {
  return MODES.some((m) => {
    return m === v
  })
}

/** An include/exclude rule: the mode, then the items to include or exclude. `onChange(null)` means all. */
const RuleField = ({
  items,
  hint,
  choices,
  mode,
  selected,
  onChange,
}: {
  items: string // plural, Title Case: "Countries"
  hint: string
  choices: Choice[]
  mode: RuleMode
  selected: string[]
  onChange: (rule: { mode: RuleMode; selected: string[] } | null) => void
}) => {
  return (
    <Field label={items} hint={hint}>
      {(id) => {
        return (
          <div className="flex flex-col gap-y-2">
            <Select
              size="small"
              value={mode}
              onValueChange={(next) => {
                if (isMode(next)) {
                  onChange(next === 'all' ? null : { mode: next, selected })
                }
              }}
            >
              <Select.Trigger id={id}>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {MODES.map((m) => {
                  return (
                    <Select.Item key={m} value={m}>
                      {`${MODE_LABELS[m]} ${items}`}
                    </Select.Item>
                  )
                })}
              </Select.Content>
            </Select>
            {mode !== 'all' ? (
              <MultiSelect
                label={items.toLowerCase()}
                choices={choices}
                selected={selected}
                onChange={(next) => {
                  onChange({ mode, selected: next })
                }}
              />
            ) : null}
          </div>
        )
      }}
    </Field>
  )
}

export const AvailabilityForm = ({ value, onChange, choices }: SectionProps & { choices: Choices }) => {
  return (
    <>
      <RuleField
        items="Countries"
        hint="Matched against the cart's shipping address."
        choices={choices.countries}
        mode={value.countries?.mode ?? 'all'}
        selected={value.countries?.countries ?? []}
        onChange={(rule) => {
          onChange({ countries: rule && { mode: rule.mode, countries: rule.selected } })
        }}
      />
      <RuleField
        items="Currencies"
        hint="Matched against the cart's currency."
        choices={choices.currencies}
        mode={value.currencies?.mode ?? 'all'}
        selected={value.currencies?.currencies ?? []}
        onChange={(rule) => {
          onChange({ currencies: rule && { mode: rule.mode, currencies: rule.selected } })
        }}
      />
      <RuleField
        items="Shipping Options"
        hint="Matched against the shipping method chosen in the cart."
        choices={choices.shippingOptions}
        mode={value.shipping_option_ids?.mode ?? 'all'}
        selected={value.shipping_option_ids?.shipping_option_ids ?? []}
        onChange={(rule) => {
          onChange({ shipping_option_ids: rule && { mode: rule.mode, shipping_option_ids: rule.selected } })
        }}
      />
      <Field label="Fee Label" hint='Line item title of the payment fee (set in Amounts). Default: "Payment Fee".'>
        {(id) => {
          return (
            <Input
              id={id}
              size="small"
              value={value.fee_label ?? ''}
              onChange={(e) => {
                return onChange({ fee_label: e.target.value || null })
              }}
            />
          )
        }}
      </Field>
    </>
  )
}
