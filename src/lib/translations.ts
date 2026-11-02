import type { ITranslationModuleService, MedusaContainer } from '@medusajs/framework/types'
import { FeatureFlag, Modules, normalizeLocale } from '@medusajs/framework/utils'
import { z } from 'zod'
import { parseRow } from './parse'
import { SETTINGS_REFERENCE, type ProviderSettings } from './types'

type Translatable = Pick<ProviderSettings, 'label' | 'description' | 'fee_label' | 'instructions'>

const translationSchema = z.object({ translations: z.record(z.string(), z.unknown()).nullish() })

/**
 * The settings' translatable fields in `locale`, from Medusa's translation module. Like Medusa's applyTranslations, the
 * locale must match exactly (after normalizing) and a blank translation falls back to the base value; unlike it, a
 * field with an empty base value is translated too. Base values without the translation feature, a locale or a stored
 * settings row.
 */
export const translateSettings = async (
  container: MedusaContainer,
  settings: (Translatable & { id?: string }) | null,
  locale?: string | null,
): Promise<Translatable> => {
  const base = {
    label: settings?.label ?? null,
    description: settings?.description ?? null,
    fee_label: settings?.fee_label ?? null,
    instructions: settings?.instructions ?? null,
  }

  // The translation module is only loaded with the feature flag on.
  if (!settings?.id || !locale || !FeatureFlag.isFeatureEnabled('translation')) {
    return base
  }

  // Registered with the flag on unless the app's config leaves the module out; then there is nothing to translate with.
  const translation = container.resolve<ITranslationModuleService | undefined>(Modules.TRANSLATION, {
    allowUnregistered: true,
  })

  if (!translation) {
    return base
  }

  const row = (
    await translation.listTranslations(
      { reference: SETTINGS_REFERENCE, reference_id: settings.id, locale_code: normalizeLocale(locale) },
      { select: ['translations'] },
    )
  ).at(0)
  const translations = row ? (parseRow(translationSchema, row, 'translation').translations ?? {}) : {}
  const pick = (field: keyof Translatable): string | null => {
    const value = translations[field]

    return typeof value === 'string' && value.trim() ? value : base[field]
  }

  return {
    label: pick('label'),
    description: pick('description'),
    fee_label: pick('fee_label'),
    instructions: pick('instructions'),
  }
}
