import { Container, Heading, Skeleton, Text } from '@medusajs/ui'
import { Link, Outlet, type UIMatch, useParams } from 'react-router-dom'
import { providerIdFromUrl, providerLabel, sectionsForType } from '../../../../../lib/admin-format'
import { AvailabilitySection } from '../../../../components/availability-section'
import { BankAccountsSection } from '../../../../components/bank-accounts-section'
import { CaptureSection } from '../../../../components/capture-section'
import { PaymentDetailsSection } from '../../../../components/payment-details-section'
import { ProviderSection } from '../../../../components/provider-section'
import { isNotFound, useChoices, useManualProviders, useProviderSettings } from '../../../../lib/queries'

const NotFound = ({ id }: { id: string }) => {
  return (
    <Container className="flex flex-col items-start gap-y-2 px-6 py-4">
      <Heading>Provider Not Found</Heading>
      <Text size="small" className="text-ui-fg-subtle">
        There is no manual payment provider with the ID {id}.
      </Text>
      <Link to="/settings/manual-payments" className="txt-compact-small text-ui-fg-interactive hover:underline">
        Back to Manual Payments
      </Link>
    </Container>
  )
}

// Like the dashboard's GeneralSectionSkeleton.
const SectionSkeleton = ({ rows }: { rows: number }) => {
  return (
    <Container className="divide-y p-0" aria-hidden>
      <div className="px-6 py-4">
        <Skeleton className="h-7 w-48" />
      </div>
      {Array.from({ length: rows }, (_, i) => {
        return (
          <div key={i} className="grid grid-cols-2 items-center px-6 py-4">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-40" />
          </div>
        )
      })}
    </Container>
  )
}

const ProviderDetailPage = () => {
  const { id: urlId = '' } = useParams()
  const id = providerIdFromUrl(urlId)
  const providers = useManualProviders()
  const settings = useProviderSettings(id)
  const choices = useChoices()
  const provider = providers.data?.providers.find((p) => {
    return p.provider_id === id
  })

  if (isNotFound(settings.error) || (providers.isSuccess && !provider)) {
    return <NotFound id={id} />
  }

  if (providers.isError) {
    throw providers.error
  }

  if (settings.isError) {
    throw settings.error
  }

  if (!provider || !settings.data) {
    return (
      <div className="flex flex-col gap-y-3" aria-busy>
        <SectionSkeleton rows={0} />
        <SectionSkeleton rows={7} />
        <SectionSkeleton rows={3} />
      </div>
    )
  }

  const s = settings.data.settings
  const sections = sectionsForType(provider.type)

  return (
    <div className="flex flex-col gap-y-3">
      <ProviderSection providerId={id} type={provider.type} settings={s} />
      <AvailabilitySection settings={s} choices={choices} />
      <PaymentDetailsSection settings={s} referenceAndQr={sections.referenceAndQr} />
      {sections.bankAccounts ? <BankAccountsSection settings={s} countries={choices.countries} /> : null}
      <CaptureSection settings={s} />
      <Outlet />
    </div>
  )
}

// Reads the settings through the page's own (cached) query, so it follows label edits.
const ProviderCrumb = ({ urlId }: { urlId: string }) => {
  const id = providerIdFromUrl(urlId)
  const { data } = useProviderSettings(id)

  return <>{providerLabel(id, data?.settings.label)}</>
}

export const handle = {
  breadcrumb: (match: UIMatch) => {
    return <ProviderCrumb urlId={match.params.id ?? ''} />
  },
}

export default ProviderDetailPage
