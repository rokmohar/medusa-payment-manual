import assert from 'node:assert/strict'
import { test } from 'node:test'
import { z } from 'zod'
import { formatIssues } from '../../src/lib/parse'

test('formatIssues lists each issue as path: message', () => {
  const result = z.object({ a: z.object({ b: z.number() }), c: z.string() }).safeParse({ a: { b: 'x' }, c: 1 })

  assert.ok(!result.success)
  assert.equal(
    formatIssues(result.error),
    'a.b: Invalid input: expected number, received string; c: Invalid input: expected string, received number',
  )

  const root = z.number().safeParse('x')

  assert.ok(!root.success)
  assert.equal(formatIssues(root.error), '(root): Invalid input: expected number, received string')
})
