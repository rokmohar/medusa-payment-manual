export type Choice = { code: string; name: string }

/** The choices plus any selected code they no longer contain (e.g. a deleted shipping option), so it stays removable. */
export const withSelected = (choices: Choice[], selected: string[]): (Choice & { label: string })[] => {
  const missing = selected.filter((code) => {
    return !choices.some((c) => {
      return c.code === code
    })
  })

  return [
    ...choices.map((c) => {
      return { ...c, label: `${c.name} (${c.code})` }
    }),
    ...missing.map((code) => {
      return { code, name: code, label: `${code} (unavailable)` }
    }),
  ]
}
