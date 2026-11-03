import { Container, toast } from '@medusajs/ui'
import { useRef, useState } from 'react'
import { QR_TYPE_LABELS, SCHEME_LABELS, mergeSettingsPatch } from '../../lib/admin-format'
import { buildReference } from '../../lib/reference'
import type { ProviderSettings } from '../../lib/types'
import { type AdminSettings, messageOf, useIsSaving, useSaveSettings } from '../lib/queries'
import { EditDrawer, useDraft } from './edit-drawer'
import { PaymentDetailsForm } from './payment-details-form'
import { SectionHeader, SectionRow } from './section'

// The settings this section edits; saving merges only these onto the latest settings. Without the reference and QR
// fields (cash on delivery) those settings are not owned here, so they stay as stored.
const KEYS: (keyof ProviderSettings)[] = ['instructions']
const REFERENCE_KEYS: (keyof ProviderSettings)[] = [
  'reference_template',
  'reference_scheme',
  'qr_type',
  'upn_purpose_code',
]

const PaymentDetailsDrawer = ({
  settings,
  referenceAndQr,
  onClose,
  returnFocus,
}: {
  settings: ProviderSettings
  referenceAndQr: boolean
  onClose: () => void
  returnFocus: () => void
}) => {
  const keys = referenceAndQr ? [...KEYS, ...REFERENCE_KEYS] : KEYS
  const { draft, setDraft, dirty, error, setError } = useDraft(settings, keys)
  const save = useSaveSettings(settings.provider_id)

  return (
    <EditDrawer
      title="Edit Payment Details"
      dirty={dirty}
      isSaving={save.isPending}
      error={error}
      onClose={onClose}
      returnFocus={returnFocus}
      onSubmit={() => {
        setError(null)
        save.mutate(
          (latest) => {
            return mergeSettingsPatch(latest, draft, keys)
          },
          {
            onSuccess: () => {
              toast.success('Payment details updated successfully')
              onClose()
            },
            onError: (err) => {
              setError(messageOf(err))
            },
          },
        )
      }}
    >
      <PaymentDetailsForm
        referenceAndQr={referenceAndQr}
        value={draft}
        onChange={(patch) => {
          setDraft((prev) => {
            return { ...prev, ...patch }
          })
        }}
      />
    </EditDrawer>
  )
}

const referenceLabel = (s: ProviderSettings): string => {
  if (!s.reference_template) {
    return 'None'
  }

  const example = buildReference(s.reference_template, s.reference_scheme, 1234)

  return [
    `${SCHEME_LABELS[s.reference_scheme]} · ${s.reference_template}`,
    `Order #1234: ${example ?? 'invalid for this scheme'}`,
  ].join('\n')
}

export const PaymentDetailsSection = ({
  settings,
  referenceAndQr,
}: {
  settings: AdminSettings
  referenceAndQr: boolean
}) => {
  const [editing, setEditing] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const saving = useIsSaving(settings.provider_id)
  const qr = QR_TYPE_LABELS[settings.qr_type]

  return (
    <Container className="divide-y p-0">
      <SectionHeader
        title="Payment Details"
        disabled={saving}
        translatable={{ settingsId: settings.id }}
        triggerRef={trigger}
        onEdit={() => {
          setEditing(true)
        }}
      />
      <SectionRow title="Instructions" value={settings.instructions ?? ''} />
      {referenceAndQr ? (
        <>
          <SectionRow title="Reference" value={referenceLabel(settings)} />
          <SectionRow
            title="QR Code"
            value={settings.qr_type === 'upn' ? `${qr} · purpose ${settings.upn_purpose_code ?? 'OTHR'}` : qr}
          />
        </>
      ) : null}
      {editing ? (
        <PaymentDetailsDrawer
          settings={settings}
          referenceAndQr={referenceAndQr}
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
