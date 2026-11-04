/**
 * Kiểm thử tích hợp (cần mạng): `pnpm run test:live` (đổi video bằng biến môi trường VIDEO_ID).
 */
import { describe, expect, it } from 'vitest'
import { loadCaptions } from '../src/main/captions'

const ID = process.env.VIDEO_ID ?? '4ycKrWTvzNY'

describe('loadCaptions (live)', () => {
  it('lấy phụ đề thật', async () => {
    const r = await loadCaptions(ID, 'auto')
    console.log(r.title, r.lang, r.kind, r.cues.length)
    console.log(r.cues.slice(0, 8))
    expect(r.cues.length).toBeGreaterThan(5)
  }, 90000)

  it('báo lỗi tiếng Việt khi video không tồn tại', async () => {
    await expect(loadCaptions('aaaaaaaaaaa', 'auto')).rejects.toThrow()
  }, 90000)
})
