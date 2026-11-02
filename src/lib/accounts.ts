import type { BankAccount } from './types'

export const selectBankAccounts = (accounts: BankAccount[], country: string | null): BankAccount[] => {
  const c = country?.toLowerCase()
  const matched = c
    ? accounts.filter((a) => {
        return a.countries.includes(c)
      })
    : []

  return matched.length
    ? matched
    : accounts
        .filter((a) => {
          return a.countries.length === 0
        })
        .slice(0, 1)
}
