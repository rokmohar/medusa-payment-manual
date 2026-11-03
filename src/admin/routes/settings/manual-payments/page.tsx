import { defineRouteConfig } from '@medusajs/admin-sdk'
import { ArrowDownMini, ArrowUpMini } from '@medusajs/icons'
import {
  Container,
  DataTable,
  Heading,
  StatusBadge,
  Text,
  createDataTableColumnHelper,
  toast,
  useDataTable,
} from '@medusajs/ui'
import { Link, useNavigate } from 'react-router-dom'
import {
  captureModeLabel,
  formatAmounts,
  moveItem,
  paymentTypeLabel,
  providerLabel,
  providerUrlId,
  rowIdOf,
  summarizeRule,
} from '../../../../lib/admin-format'
import { ActionMenu } from '../../../components/action-menu'
import { type ManualProvider, useIsRanking, useManualProviders, useRankProviders } from '../../../lib/queries'

const detailPath = (id: string) => {
  return `/settings/manual-payments/${encodeURIComponent(providerUrlId(id))}`
}

// The list comes sorted by rank; moving posts the whole new order.
const RankActions = ({ provider }: { provider: ManualProvider }) => {
  const { data } = useManualProviders()
  const rank = useRankProviders()
  const saving = useIsRanking()
  const ids = (data?.providers ?? []).map((p) => {
    return p.provider_id
  })
  const index = ids.indexOf(provider.provider_id)
  const move = (dir: -1 | 1) => {
    rank.mutate(moveItem(ids, index, dir), {
      onSuccess: () => {
        toast.success('Payment providers reordered successfully')
      },
    })
  }

  return (
    // The menu's own clicks must not open the row's detail page.
    <div
      className="flex justify-end"
      onClick={(e) => {
        e.stopPropagation()
      }}
    >
      <ActionMenu
        label={`${providerLabel(provider.provider_id, provider.settings?.label)} actions`}
        groups={[
          {
            actions: [
              {
                icon: <ArrowUpMini />,
                label: 'Move Up',
                disabled: index <= 0 || saving,
                onClick: () => {
                  move(-1)
                },
              },
              {
                icon: <ArrowDownMini />,
                label: 'Move Down',
                disabled: index < 0 || index === ids.length - 1 || saving,
                onClick: () => {
                  move(1)
                },
              },
            ],
          },
        ]}
      />
    </div>
  )
}

const columnHelper = createDataTableColumnHelper<ManualProvider>()

const columns = [
  columnHelper.accessor('provider_id', {
    header: 'Provider',
    cell: ({ getValue, row }) => {
      const id = getValue()

      return (
        <div className="flex min-w-0 flex-col">
          {/* A real link keeps rows reachable by keyboard and openable in a new tab. */}
          <Link
            to={detailPath(id)}
            className="text-ui-fg-base focus-visible:shadow-borders-focus truncate rounded-sm outline-none"
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            {providerLabel(id, row.original.settings?.label)}
          </Link>
          <span className="text-ui-fg-muted truncate">{id}</span>
        </div>
      )
    },
  }),
  columnHelper.accessor('type', {
    header: 'Type',
    cell: ({ getValue }) => {
      return paymentTypeLabel(getValue())
    },
  }),
  columnHelper.display({
    id: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const enabled = row.original.settings?.enabled ?? true

      return <StatusBadge color={enabled ? 'green' : 'grey'}>{enabled ? 'Enabled' : 'Disabled'}</StatusBadge>
    },
  }),
  columnHelper.display({
    id: 'capture',
    header: 'Capture',
    cell: ({ row }) => {
      return captureModeLabel(row.original.settings?.capture_mode ?? 'manual')
    },
  }),
  columnHelper.display({
    id: 'countries',
    header: 'Countries',
    cell: ({ row }) => {
      const rule = row.original.settings?.countries

      return summarizeRule(rule?.mode, rule?.countries ?? [])
    },
  }),
  columnHelper.display({
    id: 'fee',
    header: 'Fee',
    cell: ({ row }) => {
      return formatAmounts(row.original.settings?.fee ?? null)
    },
  }),
  columnHelper.display({
    id: 'actions',
    cell: ({ row }) => {
      return <RankActions provider={row.original} />
    },
  }),
]

const ManualPaymentsPage = () => {
  const navigate = useNavigate()
  const { data, isPending, isError, error } = useManualProviders()
  const providers = data?.providers ?? []
  const table = useDataTable({
    data: providers,
    columns,
    rowCount: providers.length,
    getRowId: (row) => {
      return row.provider_id
    },
    isLoading: isPending,
    onRowClick: (_e, row: unknown) => {
      const id = rowIdOf(row)

      if (id) {
        navigate(detailPath(id))
      }
    },
  })

  if (isError) {
    throw error
  }

  return (
    <Container className="divide-y p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex flex-col items-start justify-between gap-2 md:flex-row md:items-center">
          <div>
            <Heading>Manual Payments</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Bank transfer, cash on delivery and other offline payment methods, in checkout order
            </Text>
          </div>
        </DataTable.Toolbar>
        <DataTable.Table
          emptyState={{
            empty: {
              heading: 'No Manual Payment Providers',
              description:
                'Register @rokmohar/medusa-payment-manual/providers/manual with the Payment Module in medusa-config to add one.',
            },
          }}
        />
      </DataTable>
    </Container>
  )
}

export const config = defineRouteConfig({ label: 'Manual Payments' })

export const handle = {
  breadcrumb: () => {
    return 'Manual Payments'
  },
}

export default ManualPaymentsPage
