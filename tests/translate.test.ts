import { describe, expect, it, vi } from 'vitest'
import { makeBatches, translateItems, translateWithRetry, type BatchItem } from '../src/main/translate/batcher'
import { TranslateError, type TranslationProvider } from '../src/main/translate/TranslationProvider'

describe('makeBatches', () => {
  const items: BatchItem[] = Array.from({ length: 45 }, (_, i) => ({ i, text: `Sentence ${i}` }))

  it('tạo lô đầu nhỏ (mặc định 8 câu), các lô sau theo size', () => {
    const batches = makeBatches(items, { first: 5, size: 20 })
    expect(batches.length).toBe(3)
    expect(batches[0].length).toBe(5)
    expect(batches[1].length).toBe(20)
    expect(batches[2].length).toBe(20)
    expect(batches.flat().map((b) => b.i)).toEqual(items.map((b) => b.i))
  })

  it('ngắt lô khi vượt quá maxChars', () => {
    const big: BatchItem[] = [
      { i: 0, text: 'a'.repeat(2000) },
      { i: 1, text: 'b'.repeat(2000) },
      { i: 2, text: 'c'.repeat(1000) }
    ]
    const batches = makeBatches(big, { first: 10, size: 10, maxChars: 2500 })
    expect(batches.length).toBe(3)
  })
})

describe('translateWithRetry', () => {
  it('dịch thành công khi provider trả đúng', async () => {
    const provider: TranslationProvider = {
      id: 'mock',
      translateBatch: vi.fn().mockResolvedValue(['Chào', 'Bạn'])
    }
    const res = await translateWithRetry(provider, ['Hello', 'You'], 'en', 'vi')
    expect(res).toEqual(['Chào', 'Bạn'])
  })

  it('chia đôi lô khi gặp lỗi COUNT_MISMATCH', async () => {
    const provider: TranslationProvider = {
      id: 'mock',
      translateBatch: vi.fn()
        .mockRejectedValueOnce(new TranslateError('COUNT_MISMATCH', 'lệch'))
        .mockResolvedValueOnce(['Chào', 'Một']) // nửa đầu
        .mockResolvedValueOnce(['Hai', 'Ba'])   // nửa sau
    }
    const res = await translateWithRetry(provider, ['A', 'B', 'C', 'D'], 'en', 'vi')
    expect(res).toEqual(['Chào', 'Một', 'Hai', 'Ba'])
  })

  it('thử lại khi gặp lỗi retryable', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined)
    const provider: TranslationProvider = {
      id: 'mock',
      translateBatch: vi.fn()
        .mockRejectedValueOnce(new TranslateError('TRANSLATE_RATE_LIMIT', 'rate limit', true))
        .mockResolvedValueOnce(['Chào'])
    }
    const res = await translateWithRetry(provider, ['Hello'], 'en', 'vi', {
      retryDelaysMs: [10],
      sleep
    })
    expect(res).toEqual(['Chào'])
    expect(sleep).toHaveBeenCalledWith(10)
  })
})

describe('translateItems', () => {
  it('gửi theo lô và gọi onBatch', async () => {
    const items: BatchItem[] = [
      { i: 0, text: 'One' },
      { i: 1, text: 'Two' },
      { i: 2, text: 'Three' }
    ]
    const provider: TranslationProvider = {
      id: 'mock',
      translateBatch: vi.fn().mockImplementation(async (texts: string[]) => texts.map((t) => `vi_${t}`))
    }
    const batchesCollected: BatchItem[][] = []
    await translateItems(provider, items, 'en', 'vi', {
      batch: { first: 2, size: 2 },
      delayMs: 0,
      onBatch: (b) => {
        batchesCollected.push(b)
      }
    })
    expect(batchesCollected.length).toBe(2)
    expect(batchesCollected[0]).toEqual([
      { i: 0, text: 'vi_One' },
      { i: 1, text: 'vi_Two' }
    ])
    expect(batchesCollected[1]).toEqual([{ i: 2, text: 'vi_Three' }])
  })
})
