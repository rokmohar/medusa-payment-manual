import { Input, Label, Select, Switch, Text } from '@medusajs/ui'
import { useId } from 'react'
import { CAPTURE_MODES, CAPTURE_MODE_LABELS } from '../../lib/admin-format'
import type { CaptureMode } from '../../lib/types'
import { Field, type SectionProps } from './fields'

const isCaptureMode = (v: string): v is CaptureMode => {
  return CAPTURE_MODES.some((m) => {
    return m === v
  })
}

export const CaptureForm = ({ value, onChange }: SectionProps) => {
  const switchId = useId()

  return (
    <>
      <Text size="small" className="text-ui-fg-subtle">
        Both apply to existing orders too, on the next job run. You will be asked to confirm changes that affect them.
      </Text>
      <Field
        label="Capture Mode"
        hint="Manual: you capture from the order page. On Order: when the order is placed. On Delivery: when it is delivered."
      >
        {(id) => {
          return (
            <Select
              size="small"
              value={value.capture_mode}
              onValueChange={(capture_mode) => {
                if (isCaptureMode(capture_mode)) {
                  onChange({ capture_mode })
                }
              }}
            >
              <Select.Trigger id={id}>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {CAPTURE_MODES.map((m) => {
                  return (
                    <Select.Item key={m} value={m}>
                      {CAPTURE_MODE_LABELS[m]}
                    </Select.Item>
                  )
                })}
              </Select.Content>
            </Select>
          )
        }}
      </Field>
      <div className="flex flex-col gap-y-1">
        <div className="flex items-center justify-between">
          <Label htmlFor={switchId} size="small" weight="plus">
            Auto-Cancel Unpaid Orders
          </Label>
          <Switch
            id={switchId}
            checked={value.auto_cancel_enabled}
            onCheckedChange={(auto_cancel_enabled) => {
              return onChange({ auto_cancel_enabled })
            }}
          />
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          Orders with any fulfillment or capture are never cancelled.
        </Text>
      </div>
      {value.auto_cancel_enabled ? (
        <Field label="Cancel After (Days)">
          {(id) => {
            return (
              <Input
                id={id}
                size="small"
                type="number"
                min={1}
                step={1}
                value={value.auto_cancel_days ?? ''}
                onChange={(e) => {
                  const n = e.target.valueAsNumber

                  onChange({ auto_cancel_days: Number.isFinite(n) ? n : null })
                }}
              />
            )
          }}
        </Field>
      ) : null}
    </>
  )
}
