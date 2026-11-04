import { describe, expect, it } from 'vitest'
import { getAsrStatus } from '../src/main/asr/paths'

describe('getAsrStatus', () => {
  it('trả về cấu trúc trạng thái ASR đầy đủ các trường', () => {
    const status = getAsrStatus()
    expect(status).toHaveProperty('hasFfmpeg')
    expect(status).toHaveProperty('hasYtDlp')
    expect(status).toHaveProperty('hasWhisper')
    expect(status).toHaveProperty('hasModel')
    expect(status).toHaveProperty('binDir')
    expect(status).toHaveProperty('modelsDir')
    expect(typeof status.hasFfmpeg).toBe('boolean')
    expect(typeof status.binDir).toBe('string')
  })
})

