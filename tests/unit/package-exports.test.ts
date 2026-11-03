import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

test('exports exposes plugin modules for Medusa bare-specifier resolution', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { exports: Record<string, unknown> }

  assert.equal(pkg.exports['./.medusa/server/src/modules/*'], './.medusa/server/src/modules/*/index.js')
})
