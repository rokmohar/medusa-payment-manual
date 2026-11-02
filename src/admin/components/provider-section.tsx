import { PencilSquare } from '@medusajs/icons'
import { Badge, Container, Heading, Input, Label, StatusBadge, Switch, Text, Textarea, toast } from '@medusajs/ui'
import { useId, useRef, useState } from 'react'
import { mergeSettingsPatch, paymentTypeLabel, providerDisplayName, providerLabel } from '../../lib/admin-format'
import type { PaymentType } from '../../lib/payment-type'
import type { ProviderSettings } from '../../lib/types'
import { type AdminSettings, messageOf, useIsSaving, useSaveSettings } from '../lib/queries'
import { ActionMenu } from './action-menu'
import { EditDrawer, useDraft } from './edit-drawer'
import { Field } from './fields'
import { useTranslateGroups } from './section'

// The settings this section edits; saving merges only these onto the latest settings.
const KEYS: (keyof ProviderSettings)[] = ['label', 'description', 'enabled']

/** Like the dashboard's sales channel edit form: the status switch lives in the edit drawer, with a hint below. */
const ProviderDrawer = ({
  settings,
  onClose,
  returnFocus,
}: {
  settings: ProviderSettings
  onClose: () => void
  returnFocus: () => void
}) => {
  const switchId = useId()
  const hintId = useId()
  const { draft, setDraft, dirty, error, setError } = useDraft(settings, KEYS)
  const save = useSaveSettings(settings.provider_id)

  return (
    <EditDrawer
      title="Edit Provider"
      dirty={dirty}
      isSaving={save.isPending}
      error={error}
      onClose={onClose}
      returnFocus={returnFocus}
      onSubmit={() => {
        setError(null)
        save.mutate(
          (latest) => {
            return mergeSettingsPatch(latest, draft, KEYS)
          },
          {
            onSuccess: () => {
              toast.success('Provider updated successfully')
              onClose()
            },
            onError: (err) => {
              setError(messageOf(err))
            },
          },
        )
      }}
    >
      <Field label="Label" hint="Shown instead of the name derived from the provider ID. Translatable.">
        {(id) => {
          return (
            <Input
              id={id}
              size="small"
              maxLength={100}
              placeholder={providerDisplayName(settings.provider_id)}
              value={draft.label ?? ''}
              onChange={(e) => {
                const label = e.target.value

                setDraft((prev) => {
                  return { ...prev, label: label || null }
                })
              }}
            />
          )
        }}
      </Field>
      <Field label="Description" hint="Shown under the payment method at checkout. Translatable.">
        {(id) => {
          return (
            <Textarea
              id={id}
              maxLength={500}
              value={draft.description ?? ''}
              onChange={(e) => {
                const description = e.target.value

                setDraft((prev) => {
                  return { ...prev, description: description || null }
                })
              }}
            />
          )
        }}
      </Field>
      <div className="flex flex-col gap-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={switchId} size="small" weight="plus">
            Enabled
          </Label>
          <Switch
            id={switchId}
            aria-describedby={hintId}
            checked={draft.enabled}
            onCheckedChange={(enabled) => {
              setDraft((prev) => {
                return { ...prev, enabled }
              })
            }}
          />
        </div>
        <Text id={hintId} size="small" className="text-ui-fg-subtle">
          When disabled, customers can no longer choose this payment method at checkout. Existing orders are not
          affected.
        </Text>
      </div>
    </EditDrawer>
  )
}

export const ProviderSection = ({
  providerId,
  type,
  settings,
}: {
  providerId: string
  type: PaymentType
  settings: AdminSettings
}) => {
  const [editing, setEditing] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const saving = useIsSaving(settings.provider_id)
  const translateGroups = useTranslateGroups(settings.id)

  return (
    <Container className="p-0">
      <div className="flex items-center justify-between gap-x-4 px-6 py-4">
        <div className="min-w-0">
          <Heading className="break-words">{providerLabel(providerId, settings.label)}</Heading>
          <Text size="small" className="text-ui-fg-subtle break-all">
            {providerId}
          </Text>
        </div>
        <div className="flex shrink-0 items-center gap-x-2">
          <Badge size="2xsmall">{paymentTypeLabel(type)}</Badge>
          <StatusBadge color={settings.enabled ? 'green' : 'grey'}>
            {settings.enabled ? 'Enabled' : 'Disabled'}
          </StatusBadge>
          <ActionMenu
            label="Provider actions"
            triggerRef={trigger}
            groups={[
              {
                actions: [
                  {
                    icon: <PencilSquare />,
                    label: 'Edit',
                    disabled: saving,
                    onClick: () => {
                      setEditing(true)
                    },
                  },
                ],
              },
              ...translateGroups,
            ]}
          />
        </div>
      </div>
      {editing ? (
        <ProviderDrawer
          settings={settings}
          onClose={() => {
            setEditing(false)
          }}
          returnFocus={() => {
            trigger.current?.focus()
          }}
        />
      ) : null}
    </Container>
  )
}
