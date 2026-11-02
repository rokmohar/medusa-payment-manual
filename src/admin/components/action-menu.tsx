import { EllipsisHorizontal } from '@medusajs/icons'
import { DropdownMenu, IconButton, Tooltip, clx } from '@medusajs/ui'
import type { ReactNode, Ref } from 'react'

export type Action = {
  icon: ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  /** Shown when a disabled action is hovered, like the dashboard's ConditionalTooltip. */
  disabledTooltip?: string
}

/** Mirrors the dashboard's ActionMenu (components/common/action-menu), which extensions can't import. */
export const ActionMenu = ({
  groups,
  label,
  triggerRef,
}: {
  groups: { actions: Action[] }[]
  label: string
  triggerRef?: Ref<HTMLButtonElement>
}) => {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <IconButton ref={triggerRef} size="small" variant="transparent" aria-label={label}>
          <EllipsisHorizontal />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        {groups.map((group, i) => {
          return (
            <DropdownMenu.Group key={i}>
              {group.actions.map((action) => {
                const item = (
                  <DropdownMenu.Item
                    disabled={action.disabled}
                    onClick={(e) => {
                      e.stopPropagation()
                      action.onClick()
                    }}
                    className={clx('flex items-center gap-x-2 [&_svg]:text-ui-fg-subtle', {
                      '[&_svg]:text-ui-fg-disabled': action.disabled,
                    })}
                  >
                    {action.icon}
                    <span>{action.label}</span>
                  </DropdownMenu.Item>
                )

                return action.disabled && action.disabledTooltip ? (
                  <Tooltip key={action.label} content={action.disabledTooltip} side="right">
                    <div>{item}</div>
                  </Tooltip>
                ) : (
                  <div key={action.label}>{item}</div>
                )
              })}
              {i < groups.length - 1 ? <DropdownMenu.Separator /> : null}
            </DropdownMenu.Group>
          )
        })}
      </DropdownMenu.Content>
    </DropdownMenu>
  )
}
