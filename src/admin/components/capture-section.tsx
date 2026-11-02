import { Container, toast } from '@medusajs/ui'
import { useRef, useState } from 'react'
import { autoCancelLabel, captureModeLabel, mergeSettingsPatch } from '../../lib/admin-format'
import { needsImpactConfirmation } from '../../lib/impact'
import type { ProviderSettings } from '../../lib/types'
import { type Impact, messageOf, useImpact, useIsSaving, useSaveSettings } from '../lib/queries'
import { CaptureForm } from './capture-form'
import { ImpactConfirmDialog } from './confirm-dialog'
import { EditDrawer, useDraft } from './edit-drawer'
import { SectionHeader, SectionRow } from './section'

// The settings this section edits; saving merges only these onto the latest settings.
const KEYS: (keyof ProviderSettings)[] = ['capture_mode', 'auto_cancel_enabled', 'auto_cancel_days']

const CaptureDrawer = ({
  settings,
  onClose,
  returnFocus,
}: {
  settings: ProviderSettings
  onClose: () => void
  returnFocus: () => void
}) => {
  const { draft, setDraft, dirty, error, setError } = useDraft(settings, KEYS)
  const [impact, setImpact] = useState<Impact | null>(null)
  const save = useSaveSettings(settings.provider_id)
  const check = useImpact(settings.provider_id)
  const onError = (err: Error) => {
    setError(messageOf(err))
  }
  const doSave = () => {
    save.mutate(
      (latest) => {
        return mergeSettingsPatch(latest, draft, KEYS)
      },
      {
        onSuccess: () => {
          toast.success('Capture and auto-cancel updated successfully')
          onClose()
        },
        onError,
      },
    )
  }

  return (
    <EditDrawer
      title="Edit Capture And Auto-Cancel"
      dirty={dirty}
      isSaving={save.isPending || check.isPending}
      error={error}
      onClose={onClose}
      returnFocus={returnFocus}
      onSubmit={() => {
        setError(null)

        // Changes that newly capture or cancel existing orders show their impact first.
        if (needsImpactConfirmation(settings, draft)) {
          check.mutate(draft, { onSuccess: setImpact, onError })
        } else {
          doSave()
        }
      }}
    >
      <CaptureForm
        value={draft}
        onChange={(patch) => {
          setDraft((prev) => {
            return { ...prev, ...patch }
          })
        }}
      />
      <ImpactConfirmDialog
        impact={impact}
        onConfirm={() => {
          setImpact(null)
          doSave()
        }}
        onCancel={() => {
          setImpact(null)
        }}
      />
    </EditDrawer>
  )
}

export const CaptureSection = ({ settings }: { settings: ProviderSettings }) => {
  const [editing, setEditing] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const saving = useIsSaving(settings.provider_id)

  return (
    <Container className="divide-y p-0">
      <SectionHeader
        title="Capture And Auto-Cancel"
        disabled={saving}
        triggerRef={trigger}
        onEdit={() => {
          setEditing(true)
        }}
      />
      <SectionRow title="Capture Mode" value={captureModeLabel(settings.capture_mode)} />
      <SectionRow title="Auto-Cancel" value={autoCancelLabel(settings)} />
      {editing ? (
        <CaptureDrawer
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
