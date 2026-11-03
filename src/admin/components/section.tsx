import { GlobeEurope, PencilSquare } from '@medusajs/icons'
import { Heading, Text } from '@medusajs/ui'
import type { ReactNode, Ref } from 'react'
import { useNavigate } from 'react-router-dom'
import { NONE, translationsUrl } from '../../lib/admin-format'
import { useTranslationEnabled } from '../lib/queries'
import { type Action, ActionMenu } from './action-menu'

/**
 * The "Translate" action group: opens Medusa's translation editor for the settings row, like the dashboard's
 * "Translations" actions. Empty without the translation feature, and disabled until the settings are saved (no row to
 * reference yet).
 */
export const useTranslateGroups = (settingsId: string | undefined): { actions: Action[] }[] => {
  const navigate = useNavigate()
  const translationEnabled = useTranslationEnabled()

  if (!translationEnabled) {
    return []
  }

  return [
    {
      actions: [
        {
          icon: <GlobeEurope />,
          label: 'Translate',
          onClick: () => {
            if (settingsId) {
              navigate(translationsUrl(settingsId))
            }
          },
          disabled: !settingsId,
          disabledTooltip: 'Save the settings first to translate them',
        },
      ],
    },
  ]
}

/**
 * Section title with an action menu holding "Edit" (then any extra `actions`, like the dashboard's "Edit Prices"), like
 * the dashboard's detail sections, plus "Translate" when `translatable`.
 */
export const SectionHeader = ({
  title,
  onEdit,
  disabled,
  triggerRef,
  translatable,
  actions = [],
}: {
  title: string
  onEdit: () => void
  disabled: boolean
  triggerRef: Ref<HTMLButtonElement>
  translatable?: { settingsId: string | undefined }
  actions?: Action[]
}) => {
  const translateGroups = useTranslateGroups(translatable?.settingsId)
  const groups = [
    { actions: [{ icon: <PencilSquare />, label: 'Edit', onClick: onEdit, disabled }, ...actions] },
    ...(translatable ? translateGroups : []),
  ]

  return (
    <div className="flex items-center justify-between px-6 py-4">
      <Heading level="h2">{title}</Heading>
      <ActionMenu label={`${title} actions`} triggerRef={triggerRef} groups={groups} />
    </div>
  )
}

/** Mirrors the dashboard's SectionRow (components/common/section): label left, value right. */
export const SectionRow = ({ title, value }: { title: string; value: ReactNode }) => {
  return (
    <div className="text-ui-fg-subtle grid w-full grid-cols-2 items-center gap-4 px-6 py-4">
      <Text size="small" weight="plus" leading="compact">
        {title}
      </Text>
      {typeof value === 'string' ? (
        <Text size="small" leading="compact" className="whitespace-pre-line text-pretty break-words">
          {value || NONE}
        </Text>
      ) : (
        <div className="txt-compact-small flex min-w-0 flex-wrap gap-1">{value}</div>
      )}
    </div>
  )
}
