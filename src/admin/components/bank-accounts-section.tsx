import { ArrowDownMini, ArrowUpMini, CheckCircle, PencilSquare, Trash } from '@medusajs/icons'
import {
  Badge,
  Button,
  Container,
  DataTable,
  Heading,
  Text,
  createDataTableColumnHelper,
  toast,
  useDataTable,
  usePrompt,
} from '@medusajs/ui'
import { useRef, useState } from 'react'
import {
  NONE,
  canDeleteAccount,
  defaultAccountId,
  formatIban,
  isDefaultAccount,
  moveItem,
  rowIdOf,
  setDefaultAccount,
} from '../../lib/admin-format'
import type { Choice } from '../../lib/choices'
import type { BankAccount, ProviderSettings } from '../../lib/types'
import { messageOf, useIsSaving, useSaveSettings } from '../lib/queries'
import { type Action, ActionMenu } from './action-menu'
import { BankAccountForm, newAccount } from './bank-account-form'
import { EditDrawer, useDraft } from './edit-drawer'

const ACCOUNT_KEYS: (keyof BankAccount)[] = [
  'recipient',
  'address_1',
  'postal_code',
  'city',
  'country_code',
  'iban',
  'bic',
  'bank_name',
  'countries',
]

const columnHelper = createDataTableColumnHelper<BankAccount>()

const accountName = (a: BankAccount): string => {
  return a.recipient.trim() || formatIban(a.iban)
}

const BankAccountDrawer = ({
  settings,
  account,
  countries,
  onClose,
  returnFocus,
}: {
  settings: ProviderSettings
  account: BankAccount
  countries: Choice[]
  onClose: () => void
  returnFocus: () => void
}) => {
  const { draft, setDraft, dirty, error, setError } = useDraft(account, ACCOUNT_KEYS)
  const save = useSaveSettings(settings.provider_id)
  const isDefault = isDefaultAccount(settings.bank_accounts, account)
  const exists = settings.bank_accounts.some((a) => {
    return a.id === account.id
  })

  return (
    <EditDrawer
      title={exists ? 'Edit Bank Account' : 'Add Bank Account'}
      dirty={dirty}
      isSaving={save.isPending}
      error={error}
      onClose={onClose}
      returnFocus={returnFocus}
      onSubmit={() => {
        // Exactly one account has no countries; which one changes only through "Set As Default".
        if (!isDefault && !draft.countries.length) {
          setError('Choose at least one country. To make this the default account, use Set As Default in its menu.')

          return
        }

        setError(null)
        save.mutate(
          (latest) => {
            const known = latest.bank_accounts.some((a) => {
              return a.id === draft.id
            })

            return {
              ...latest,
              bank_accounts: known
                ? latest.bank_accounts.map((a) => {
                    return a.id === draft.id ? draft : a
                  })
                : [...latest.bank_accounts, draft],
            }
          },
          {
            onSuccess: () => {
              toast.success(exists ? 'Bank account updated successfully' : 'Bank account created successfully')
              onClose()
            },
            onError: (err) => {
              setError(messageOf(err))
            },
          },
        )
      }}
    >
      <BankAccountForm value={draft} onChange={setDraft} countries={countries} isDefault={isDefault} />
    </EditDrawer>
  )
}

export const BankAccountsSection = ({ settings, countries }: { settings: ProviderSettings; countries: Choice[] }) => {
  const providerId = settings.provider_id
  // `from` is the element that opened the drawer, to return focus to.
  const [editing, setEditing] = useState<{ account: BankAccount; from: HTMLElement | null } | null>(null)
  const addButton = useRef<HTMLButtonElement>(null)
  const triggers = useRef(new Map<string, HTMLButtonElement>())
  const save = useSaveSettings(providerId)
  const saving = useIsSaving(providerId)
  const prompt = usePrompt()
  const accounts = settings.bank_accounts
  const defaultId = defaultAccountId(accounts)
  const persist = (update: (latest: BankAccount[]) => BankAccount[], message: string) => {
    save.mutate(
      (latest) => {
        return { ...latest, bank_accounts: update(latest.bank_accounts) }
      },
      {
        onSuccess: () => {
          toast.success(message)
        },
      },
    )
  }
  const move = (id: string, dir: -1 | 1) => {
    persist((latest) => {
      return moveItem(
        latest,
        latest.findIndex((a) => {
          return a.id === id
        }),
        dir,
      )
    }, 'Bank accounts reordered successfully')
  }
  const makeDefault = async (account: BankAccount) => {
    const previous = accounts.find((a) => {
      return a.id === defaultId
    })
    const handOver = previous
      ? ` ${accountName(previous)} takes over its countries (${account.countries.join(', ').toUpperCase()}).`
      : ''
    const confirmed = await prompt({
      title: 'Set As Default?',
      description: `${accountName(account)} becomes the default account, used for all countries without their own account.${handOver}`,
      confirmText: 'Set As Default',
      cancelText: 'Cancel',
      variant: 'confirmation',
    })

    if (confirmed) {
      persist((latest) => {
        return setDefaultAccount(latest, account.id)
      }, 'Default bank account updated successfully')
    }
  }
  const remove = async (account: BankAccount) => {
    const confirmed = await prompt({
      title: 'Are you sure?',
      description: `You are about to delete the bank account ${accountName(account)}. This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
    })

    if (confirmed) {
      persist((latest) => {
        return latest.filter((a) => {
          return a.id !== account.id
        })
      }, 'Bank account deleted successfully')
    }
  }

  const actionsOf = (a: BankAccount, i: number): { actions: Action[] }[] => {
    const isDefault = a.id === defaultId

    return [
      {
        actions: [
          {
            icon: <PencilSquare />,
            label: 'Edit',
            disabled: saving,
            onClick: () => {
              setEditing({ account: a, from: triggers.current.get(a.id) ?? null })
            },
          },
          ...(isDefault
            ? []
            : [
                {
                  icon: <CheckCircle />,
                  label: 'Set As Default',
                  disabled: saving,
                  onClick: () => {
                    void makeDefault(a)
                  },
                },
              ]),
        ],
      },
      {
        actions: [
          {
            icon: <ArrowUpMini />,
            label: 'Move Up',
            disabled: i === 0 || saving,
            onClick: () => {
              move(a.id, -1)
            },
          },
          {
            icon: <ArrowDownMini />,
            label: 'Move Down',
            disabled: i === accounts.length - 1 || saving,
            onClick: () => {
              move(a.id, 1)
            },
          },
        ],
      },
      {
        actions: [
          {
            icon: <Trash />,
            label: 'Delete',
            disabled: saving || !canDeleteAccount(accounts, a.id),
            disabledTooltip: canDeleteAccount(accounts, a.id) ? undefined : 'Set another account as default first.',
            onClick: () => {
              void remove(a)
            },
          },
        ],
      },
    ]
  }
  const columns = [
    columnHelper.accessor('recipient', {
      header: 'Recipient',
      cell: ({ row }) => {
        return accountName(row.original)
      },
    }),
    columnHelper.accessor('bank_name', {
      header: 'Bank',
      cell: ({ getValue }) => {
        return getValue() ?? NONE
      },
    }),
    columnHelper.accessor('iban', {
      header: 'IBAN',
      cell: ({ getValue }) => {
        return <span className="whitespace-nowrap">{formatIban(getValue())}</span>
      },
    }),
    columnHelper.accessor('countries', {
      header: 'Countries',
      cell: ({ row }) => {
        return row.original.id === defaultId ? (
          <Badge size="2xsmall">Default</Badge>
        ) : (
          row.original.countries.join(', ').toUpperCase()
        )
      },
    }),
    columnHelper.display({
      id: 'actions',
      cell: ({ row }) => {
        const a = row.original

        return (
          // The menu's own clicks must not open the row's Edit drawer.
          <div
            className="flex justify-end"
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            <ActionMenu
              label={`${accountName(a)} actions`}
              triggerRef={(el) => {
                if (el) {
                  triggers.current.set(a.id, el)
                } else {
                  triggers.current.delete(a.id)
                }
              }}
              groups={actionsOf(a, row.index)}
            />
          </div>
        )
      },
    }),
  ]
  const table = useDataTable({
    data: accounts,
    columns,
    rowCount: accounts.length,
    getRowId: (row) => {
      return row.id
    },
    onRowClick: (_e, row: unknown) => {
      const account = accounts.find((a) => {
        return a.id === rowIdOf(row)
      })

      if (account && !saving) {
        setEditing({ account, from: triggers.current.get(account.id) ?? null })
      }
    },
  })

  return (
    <Container className="divide-y p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex items-center justify-between gap-x-4">
          <div>
            <Heading level="h2">Bank Accounts</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Customers see the account for their shipping country, or the default account.
            </Text>
          </div>
          <Button
            ref={addButton}
            size="small"
            variant="secondary"
            disabled={saving}
            onClick={() => {
              setEditing({ account: newAccount(), from: addButton.current })
            }}
          >
            Add Account
          </Button>
        </DataTable.Toolbar>
        <DataTable.Table
          emptyState={{
            empty: {
              heading: 'No Bank Accounts',
              description: 'Add one to show payment details to customers.',
            },
          }}
        />
      </DataTable>
      {editing ? (
        <BankAccountDrawer
          settings={settings}
          account={editing.account}
          countries={countries}
          onClose={() => {
            setEditing(null)
          }}
          returnFocus={() => {
            // A new account's row trigger exists only after the save; fall back to the Add button.
            ;(triggers.current.get(editing.account.id) ?? editing.from ?? addButton.current)?.focus()
          }}
        />
      ) : null}
    </Container>
  )
}
