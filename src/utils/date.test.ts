import { describe, expect, it } from 'vitest'
import { toLocalDateKey } from './date'

describe('toLocalDateKey', () => {
  it('端末ローカルの深夜をUTCではなくローカル日付で扱う', () => {
    expect(toLocalDateKey(new Date(2026, 7, 28, 23, 59))).toBe('2026-08-28')
    expect(toLocalDateKey(new Date(2026, 7, 29, 0, 1))).toBe('2026-08-29')
  })
})
