import { RouteFocusModal } from '@medusajs/dashboard/components'
import { useParams } from 'react-router-dom'
import { providerIdFromUrl } from '../../../../../../lib/admin-format'
import { amountCurrencies } from '../../../../../../lib/amounts'
import { AmountsForm } from '../../../../../components/amounts-form'
import { useChoices, useProviderSettings } from '../../../../../lib/queries'

// A modal route over the provider page (its `@` folder makes it a child rendered in the page's <Outlet />), like the
// dashboard's Edit Prices.
const AmountsPage = () => {
  const { id: urlId = '' } = useParams()
  const settings = useProviderSettings(providerIdFromUrl(urlId))
  const { currencies } = useChoices()

  if (settings.isError) {
    throw settings.error
  }

  const s = settings.data?.settings

  return (
    <RouteFocusModal>
      {s ? (
        <AmountsForm
          settings={s}
          currencies={currencies}
          codes={amountCurrencies(
            currencies.map((c) => {
              return c.code
            }),
            s.currencies,
            s,
          )}
        />
      ) : null}
    </RouteFocusModal>
  )
}

export default AmountsPage
