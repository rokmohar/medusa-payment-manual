import { useId, useState } from 'react'
import { Checkbox, Input, Label, Text } from '@medusajs/ui'
import { type Choice, withSelected } from '../../lib/choices'
import type { ProviderSettings } from '../../lib/types'

export type SectionProps = {
  value: ProviderSettings
  onChange: (patch: Partial<ProviderSettings>) => void
}

export type { Choice }

/** A function child receives the control id and is wired to the label; other children are grouped under it. */
export const Field = ({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode | ((id: string) => React.ReactNode)
}) => {
  const id = useId()

  return (
    <div className="flex flex-col gap-y-1">
      <Label size="small" weight="plus" id={`${id}-label`} htmlFor={typeof children === 'function' ? id : undefined}>
        {label}
      </Label>
      {typeof children === 'function' ? (
        children(id)
      ) : (
        <div role="group" aria-labelledby={`${id}-label`}>
          {children}
        </div>
      )}
      {hint ? (
        <Text size="small" className="text-ui-fg-subtle">
          {hint}
        </Text>
      ) : null}
    </div>
  )
}

/** Scrollable, filterable checkbox list; `selected` holds the chosen codes, including ones no longer in `choices`. */
export const MultiSelect = ({
  label,
  choices,
  selected,
  onChange,
}: {
  label: string
  choices: Choice[]
  selected: string[]
  onChange: (next: string[]) => void
}) => {
  const uid = useId()
  const [filter, setFilter] = useState('')
  const q = filter.trim().toLowerCase()
  const shown = withSelected(choices, selected).filter((c) => {
    return !q || c.name.toLowerCase().includes(q) || c.code.includes(q)
  })

  return (
    <div className="flex flex-col gap-y-2">
      <Input
        size="small"
        placeholder="Filter"
        aria-label={`Filter ${label}`}
        value={filter}
        onChange={(e) => {
          return setFilter(e.target.value)
        }}
      />
      <div className="border-ui-border-base flex max-h-48 flex-col gap-y-1 overflow-y-auto rounded-md border p-2">
        {shown.length === 0 ? (
          <Text size="small" className="text-ui-fg-subtle">
            Nothing to choose from
          </Text>
        ) : null}
        {shown.map((c) => {
          const id = `${uid}-${c.code}`

          return (
            <div key={c.code} className="flex items-center gap-x-2">
              <Checkbox
                id={id}
                checked={selected.includes(c.code)}
                onCheckedChange={(on) => {
                  onChange(
                    on === true
                      ? [...selected, c.code]
                      : selected.filter((s) => {
                          return s !== c.code
                        }),
                  )
                }}
              />
              <Label htmlFor={id} size="small">
                {c.label}
              </Label>
            </div>
          )
        })}
      </div>
      <Text size="small" className="text-ui-fg-subtle">
        {selected.length} selected
      </Text>
    </div>
  )
}
