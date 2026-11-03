import { PencilSquare } from '@medusajs/icons'
import { Container, toast } from '@medusajs/ui'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatAmounts, mergeSettingsPatch, summarizeRule } from '../../lib/admin-format'
import { pruneAmounts } from '../../lib/amounts'
import type { ProviderSettings } from '../../lib/types'
import { type AdminSettings, type Choices, messageOf, useIsSaving, useSaveSettings } from '../lib/queries'
import { AvailabilityForm } from './availability-form'
import { EditDrawer, useDraft } from './edit-drawer'
import { SectionHeader, SectionRow } from './section'

// The settings the drawer edits; saving merges only these onto the latest settings. The amounts have their own modal route.
const KEYS: (keyof ProviderSettings)[] = ['countries', 'currencies', 'shipping_option_ids', 'fee_label']

const AvailabilityDrawer = ({
  settings,
  choices,
  onClose,
  returnFocus,
}: {
  settings: ProviderSettings
  choices: Choices
  onClose: () => void
  returnFocus: () => void
}) => {
  const { draft, setDraft, dirty, error, setError } = useDraft(settings, KEYS)
  const save = useSaveSettings(settings.provider_id)

  return (
    <EditDrawer
      title="Edit Availability Rules"
      dirty={dirty}
      isSaving={save.isPending}
      error={error}
      onClose={onClose}
      returnFocus={returnFocus}
      onSubmit={() => {
        setError(null)
        save.mutate(
          (latest) => {
            const next = mergeSettingsPatch(latest, draft, KEYS)

            // Amounts for currencies the new rule excludes can never apply.
            return { ...next, ...pruneAmounts(next) }
          },
          {
            onSuccess: () => {
              toast.success('Availability rules updated successfully')
              onClose()
            },
            onError: (err) => {
              setError(messageOf(err))
            },
          },
        )
      }}
    >
      <AvailabilityForm
        value={draft}
        choices={choices}
        onChange={(patch) => {
          setDraft((prev) => {
            return { ...prev, ...patch }
          })
        }}
      />
    </EditDrawer>
  )
}

export const AvailabilitySection = ({ settings, choices }: { settings: AdminSettings; choices: Choices }) => {
  const [editing, setEditing] = useState(false)
  const navigate = useNavigate()
  const trigger = useRef<HTMLButtonElement>(null)
  const saving = useIsSaving(settings.provider_id)
  const shippingName = (id: string) => {
    return (
      choices.shippingOptions.find((o) => {
        return o.code === id
      })?.name ?? id
    )
  }

  return (
    <Container className="divide-y p-0">
      <SectionHeader
        title="Availability Rules"
        disabled={saving}
        translatable={{ settingsId: settings.id }}
        triggerRef={trigger}
        onEdit={() => {
          setEditing(true)
        }}
        actions={[
          {
            icon: <PencilSquare />,
            label: 'Amounts',
            onClick: () => {
              navigate('amounts')
            },
            disabled: saving,
          },
        ]}
      />
      <SectionRow
        title="Countries"
        value={summarizeRule(settings.countries?.mode, settings.countries?.countries ?? [])}
      />
      <SectionRow
        title="Currencies"
        value={summarizeRule(settings.currencies?.mode, settings.currencies?.currencies ?? [])}
      />
      <SectionRow
        title="Shipping Options"
        value={summarizeRule(
          settings.shipping_option_ids?.mode,
          settings.shipping_option_ids?.shipping_option_ids ?? [],
          shippingName,
        )}
      />
      <SectionRow title="Minimum Total" value={formatAmounts(settings.min_total)} />
      <SectionRow title="Maximum Total" value={formatAmounts(settings.max_total)} />
      <SectionRow title="Fee" value={formatAmounts(settings.fee)} />
      <SectionRow title="Fee Label" value={settings.fee_label ?? 'Payment Fee'} />
      {editing ? (
        <AvailabilityDrawer
          settings={settings}
          choices={choices}
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
