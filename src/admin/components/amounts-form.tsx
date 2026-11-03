import {
  DataGrid,
  KeyboundForm,
  RouteFocusModal,
  createDataGridHelper,
  useRouteModal,
} from '@medusajs/dashboard/components'
import { Button, Text, toast } from '@medusajs/ui'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { mergeSettingsPatch } from '../../lib/admin-format'
import { AMOUNT_FIELDS, type AmountCell, type AmountField, cellsToAmounts, pruneAmounts } from '../../lib/amounts'
import type { CurrencyAmounts, ProviderSettings } from '../../lib/types'
import { type AmountCurrency, useSaveSettings } from '../lib/queries'

type Cells = Record<AmountField, Record<string, AmountCell>>
type Row = { field: AmountField }

const ROWS: Record<AmountField, string> = {
  min_total: 'Minimum Total',
  max_total: 'Maximum Total',
  fee: 'Payment Fee',
}
const DATA: Row[] = AMOUNT_FIELDS.map((field) => {
  return { field }
})
const columnHelper = createDataGridHelper<Row, Cells>()

const useColumns = (codes: string[], currencies: AmountCurrency[]) => {
  return useMemo(() => {
    return [
      columnHelper.column({
        id: 'amount',
        header: 'Amount',
        cell: (context) => {
          return (
            <DataGrid.ReadonlyCell context={context}>
              <span className="truncate">{ROWS[context.row.original.field]}</span>
            </DataGrid.ReadonlyCell>
          )
        },
        disableHiding: true,
      }),
      ...codes.map((code) => {
        const known = currencies.find((c) => {
          return c.code === code
        })
        const name = known ? code.toUpperCase() : `${code.toUpperCase()} (Not in store)`

        return columnHelper.column({
          id: `currency.${code}`,
          name,
          header: () => {
            return (
              <span className="truncate" title={known?.name ?? name}>
                {name}
              </span>
            )
          },
          field: (context) => {
            return `${context.row.original.field}.${code}`
          },
          type: 'number',
          cell: (context) => {
            // The currency cell looks the code up in the dashboard's currency list; a saved code it may lack gets a number cell.
            return known ? (
              <DataGrid.CurrencyCell code={code} context={context} />
            ) : (
              <DataGrid.NumberCell context={context} min={0} />
            )
          },
        })
      }),
    ]
  }, [codes, currencies])
}

const toCells = (map: CurrencyAmounts | null): Record<string, AmountCell> => {
  return { ...map }
}

/**
 * The "Amounts" modal, like the dashboard's Edit Prices: a DataGrid with one row per amount and one column per
 * currency the saved Currencies rule allows. A blank cell means no limit or no fee; saving drops amounts for
 * currencies the rule excludes.
 */
export const AmountsForm = ({
  settings,
  currencies,
  codes,
}: {
  settings: ProviderSettings
  currencies: AmountCurrency[]
  codes: string[]
}) => {
  const { handleSuccess, setCloseOnEscape } = useRouteModal()
  const save = useSaveSettings(settings.provider_id)
  const columns = useColumns(codes, currencies)
  const form = useForm<Cells>({
    defaultValues: {
      min_total: toCells(settings.min_total),
      max_total: toCells(settings.max_total),
      fee: toCells(settings.fee),
    },
  })

  const handleSubmit = form.handleSubmit((cells) => {
    const { amounts, invalid } = cellsToAmounts(cells, codes)

    if (invalid.length) {
      for (const [field, code] of invalid) {
        form.setError(`${field}.${code}`, { message: 'Enter an amount like 10.5, or leave it blank.' })
      }

      return
    }

    save.mutate(
      (latest) => {
        return mergeSettingsPatch(latest, pruneAmounts({ ...amounts, currencies: latest.currencies }), AMOUNT_FIELDS)
      },
      {
        onSuccess: () => {
          toast.success('Amounts updated successfully')
          handleSuccess()
        },
      },
    )
  })

  return (
    <RouteFocusModal.Form form={form}>
      <KeyboundForm onSubmit={handleSubmit} className="flex size-full flex-col">
        <RouteFocusModal.Header>
          <RouteFocusModal.Title className="sr-only">Amounts</RouteFocusModal.Title>
          <RouteFocusModal.Description className="sr-only">
            Minimum and maximum cart total and payment fee per currency.
          </RouteFocusModal.Description>
        </RouteFocusModal.Header>
        <RouteFocusModal.Body className="flex flex-col overflow-hidden">
          {codes.length ? (
            <DataGrid
              columns={columns}
              data={DATA}
              state={form}
              onEditingChange={(editing) => {
                setCloseOnEscape(!editing)
              }}
            />
          ) : (
            <Text size="small" className="text-ui-fg-subtle p-6">
              No currencies to set amounts for. Change the Currencies rule in Edit first.
            </Text>
          )}
        </RouteFocusModal.Body>
        <RouteFocusModal.Footer>
          <div className="flex w-full items-center justify-end gap-x-2">
            <RouteFocusModal.Close asChild>
              <Button variant="secondary" size="small">
                Cancel
              </Button>
            </RouteFocusModal.Close>
            <Button type="submit" variant="primary" size="small" isLoading={save.isPending}>
              Save
            </Button>
          </div>
        </RouteFocusModal.Footer>
      </KeyboundForm>
    </RouteFocusModal.Form>
  )
}
