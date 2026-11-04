import { describe, expect, it } from 'vitest'
import { formatWordsToCsv } from '../src/main/storage/exportCsv'
import type { SavedWord } from '../src/shared/types'

describe('formatWordsToCsv', () => {
  it('xuất đúng định dạng Anki kèm BOM UTF-8', () => {
    const words: SavedWord[] = [
      {
        id: '1',
        word: 'remember',
        ipa: '/rɪˈmɛmbə/',
        pos: 'động từ',
        meaning: 'nhớ, ghi nhớ',
        example: "I can't remember anything.",
        videoId: 'dQw4w9WgXcQ',
        timestamp: 42.5,
        createdAt: 1000
      },
      {
        id: '2',
        word: 'special, "unique"',
        meaning: 'đặc biệt, "độc đáo"',
        example: 'Line 1\nLine 2',
        videoId: 'abc12345678',
        timestamp: 10,
        createdAt: 2000
      }
    ]

    const csv = formatWordsToCsv(words)
    // Kiểm tra BOM UTF-8
    expect(csv.startsWith('\uFEFF')).toBe(true)

    // Kiểm tra dòng tiêu đề
    expect(csv).toContain('Front,Back,Example,Source')

    // Kiểm tra dòng 1
    expect(csv).toContain('remember [/rɪˈmɛmbə/] (động từ)')
    expect(csv).toContain('"nhớ, ghi nhớ"')
    expect(csv).toContain('https://youtu.be/dQw4w9WgXcQ?t=42')

    // Kiểm tra escape dấu phẩy, nháy kép và xuống dòng
    expect(csv).toContain('"special, ""unique"""')
    expect(csv).toContain('"đặc biệt, ""độc đáo"""')
    expect(csv).toContain('"Line 1\nLine 2"')
    expect(csv).toContain('https://youtu.be/abc12345678?t=10')
  })

  it('xử lý danh sách rỗng', () => {
    const csv = formatWordsToCsv([])
    expect(csv).toBe('\uFEFFFront,Back,Example,Source')
  })
})

