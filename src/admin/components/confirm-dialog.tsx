import { Prompt } from '@medusajs/ui'
import type { Impact } from '../lib/queries'

export const ImpactConfirmDialog = ({
  impact,
  onConfirm,
  onCancel,
}: {
  impact: Impact | null
  onConfirm: () => void
  onCancel: () => void
}) => {
  return (
    <Prompt
      open={impact !== null}
      onOpenChange={(open) => {
        return !open && onCancel()
      }}
    >
      <Prompt.Content>
        <Prompt.Header>
          <Prompt.Title>Confirm Impact</Prompt.Title>
          <Prompt.Description>
            This will capture {impact?.capture ?? 0} existing payments and cancel {impact?.cancel ?? 0} existing orders
            on the next run.
          </Prompt.Description>
        </Prompt.Header>
        <Prompt.Footer>
          <Prompt.Cancel onClick={onCancel}>Cancel</Prompt.Cancel>
          <Prompt.Action onClick={onConfirm}>Confirm</Prompt.Action>
        </Prompt.Footer>
      </Prompt.Content>
    </Prompt>
  )
}
