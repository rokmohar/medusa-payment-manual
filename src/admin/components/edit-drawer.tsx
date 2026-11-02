import { Button, Drawer, Heading, Prompt, Text } from '@medusajs/ui'
import { type ReactNode, useEffect, useState } from 'react'

/**
 * Mirrors the dashboard's RouteDrawer + RouteModalForm (components/modals), which extensions can't import: mounted
 * when editing starts, opened after mount so the entry animation plays, and closing a dirty form asks first.
 * `returnFocus` puts focus back on what opened the drawer (there is no Drawer.Trigger to return to).
 */
export const EditDrawer = ({
  title,
  dirty,
  isSaving,
  error,
  onClose,
  onSubmit,
  returnFocus,
  children,
}: {
  title: string
  dirty: boolean
  isSaving: boolean
  error: string | null
  onClose: () => void
  onSubmit: () => void
  returnFocus: () => void
  children: ReactNode
}) => {
  const [open, setOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    setOpen(true)
  }, [])

  const close = () => {
    // Same Radix workaround as RouteDrawer: a menu that opened the drawer can leave pointer-events: none on body.
    document.body.style.pointerEvents = 'auto'
    onClose()
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (next || isSaving) {
          return
        }

        if (dirty) {
          setLeaving(true)
        } else {
          close()
        }
      }}
    >
      <Drawer.Content
        aria-describedby={undefined}
        onCloseAutoFocus={(e) => {
          e.preventDefault()
          returnFocus()
        }}
      >
        <Drawer.Header>
          <Drawer.Title asChild>
            <Heading>{title}</Heading>
          </Drawer.Title>
        </Drawer.Header>
        <form
          noValidate
          className="flex flex-1 flex-col overflow-hidden"
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit()
          }}
        >
          <Drawer.Body className="flex max-w-full flex-1 flex-col gap-y-8 overflow-y-auto">
            {children}
            {error ? (
              <Text size="small" className="text-ui-fg-error" role="alert">
                {error}
              </Text>
            ) : null}
          </Drawer.Body>
          <Drawer.Footer>
            <div className="flex items-center justify-end gap-x-2">
              <Drawer.Close asChild>
                <Button size="small" variant="secondary" type="button" disabled={isSaving}>
                  Cancel
                </Button>
              </Drawer.Close>
              <Button size="small" type="submit" isLoading={isSaving}>
                Save
              </Button>
            </div>
          </Drawer.Footer>
        </form>
        <Prompt
          open={leaving}
          variant="confirmation"
          onOpenChange={(next) => {
            if (!next) {
              setLeaving(false)
            }
          }}
        >
          <Prompt.Content>
            <Prompt.Header>
              <Prompt.Title>Are you sure you want to leave this form?</Prompt.Title>
              <Prompt.Description>You have unsaved changes that will be lost if you exit this form.</Prompt.Description>
            </Prompt.Header>
            <Prompt.Footer>
              <Prompt.Cancel
                type="button"
                onClick={() => {
                  setLeaving(false)
                }}
              >
                Cancel
              </Prompt.Cancel>
              <Prompt.Action type="button" onClick={close}>
                Continue
              </Prompt.Action>
            </Prompt.Footer>
          </Prompt.Content>
        </Prompt>
      </Drawer.Content>
    </Drawer>
  )
}

/** Draft of a section's values; dirty when one of the `keys` it edits differs from what was loaded. */
export const useDraft = <T,>(initial: T, keys: readonly (keyof T)[]) => {
  const [draft, setDraft] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const dirty = keys.some((k) => {
    return JSON.stringify(draft[k]) !== JSON.stringify(initial[k])
  })

  return { draft, setDraft, dirty, error, setError }
}
