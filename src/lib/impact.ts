import type { ProviderSettings } from './types'

type ImpactFields = Pick<ProviderSettings, 'capture_mode' | 'auto_cancel_enabled' | 'auto_cancel_days'>

/** True when a change newly captures/cancels existing orders, so the admin must confirm the impact first. */
export const needsImpactConfirmation = (prev: ImpactFields, next: ImpactFields): boolean => {
  const capturesMore = next.capture_mode !== 'manual' && prev.capture_mode !== next.capture_mode
  const cancelsMore =
    next.auto_cancel_enabled &&
    (!prev.auto_cancel_enabled || (next.auto_cancel_days ?? Infinity) < (prev.auto_cancel_days ?? Infinity))

  return capturesMore || cancelsMore
}
