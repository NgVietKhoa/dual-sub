import { describe, expect, it } from 'vitest'
import { normalizeAsr, normalizeManual } from '../src/main/captions/normalize'
import { selectTrack, audioLangOf, type RawTrack } from '../src/main/captions/selectTrack'
import { parseVideoLink } from '../src/shared/videoId'

describe('parseVideoLink', () => {
  const id = 'dQw4w9WgXcQ'
  it.each([
    [`https://www.youtube.com/watch?v=${id}`, 0],
    [`https://youtu.be/${id}?t=90`, 90],
    [`https://youtu.be/${id}?si=abc&t=1m30s`, 90],
    [`https://www.youtube.com/shorts/${id}`, 0],
    [`youtube.com/watch?v=${id}&list=PL1&t=1h1m1s`, 3661],
    [`https://m.youtube.com/watch?feature=share&v=${id}`, 0],
    [`https://www.youtube.com/embed/${id}`, 0],
    [id, 0]
  ])('%s', (url, t) => {
    expect(parseVideoLink(url)).toEqual({ videoId: id, startSeconds: t })
  })
  it('từ chối link sai', () => {
    expect(parseVideoLink('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(parseVideoLink('https://youtube.com/watch?v=short')).toBeNull()
    expect(parseVideoLink('')).toBeNull()
  })
})

describe('normalizeAsr', () => {
  const w = (t: number, text: string) => ({ t, text })
  it('gộp thành câu theo dấu câu, bỏ từ trùng', () => {
    const cues = normalizeAsr([
      w(0.08, 'Hi'),
      w(0.4, ' everyone.'),
      w(2.16, 'Today'),
      w(2.56, ' our'),
      w(2.56, ' our'), // trùng do cửa sổ cuộn
      w(2.96, ' topic'),
      w(3.3, ' is'),
      w(3.9, ' Vietnamese'),
      w(4.6, ' people.'),
      w(5.8, ' We'),
      w(6.0, ' will'),
      w(6.4, ' listen.')
    ])
    expect(cues.map((c) => c.text)).toEqual([
      'Hi everyone.',
      'Today our topic is Vietnamese people.',
      'We will listen.'
    ])
    for (let i = 0; i < cues.length - 1; i++) expect(cues[i].end).toBeLessThanOrEqual(cues[i + 1].start)
    cues.forEach((c) => expect(c.end).toBeGreaterThan(c.start))
  })
  it('chèn khoảng trắng ở chỗ nối event, không chèn với CJK', () => {
    expect(normalizeAsr([w(0, 'We'), w(0.3, 'will'), w(0.6, ' go.')])[0].text).toBe('We will go.')
    expect(normalizeAsr([w(0, '今日'), w(0.3, 'は'), w(0.6, '晴れ。')])[0].text).toBe('今日は晴れ。')
  })
  it('cắt theo khoảng lặng khi không có dấu câu và không cắt ở viết tắt', () => {
    const cues = normalizeAsr([
      w(0, 'Mr.'),
      w(0.3, ' Smith'),
      w(0.6, ' went'),
      w(0.9, ' home'),
      w(3, ' then'),
      w(3.3, ' he'),
      w(3.6, ' slept')
    ])
    expect(cues.map((c) => c.text)).toEqual(['Mr. Smith went home', 'then he slept'])
  })
})

describe('normalizeManual', () => {
  it('bỏ trùng và ghép cue bị ngắt giữa câu', () => {
    const cues = normalizeManual([
      { start: 0, end: 2, text: 'This is a very\nlong' },
      { start: 2.1, end: 4, text: 'sentence.' },
      { start: 4, end: 6, text: 'Next one.' },
      { start: 4.2, end: 6, text: 'Next one.' }
    ])
    expect(cues.map((c) => c.text)).toEqual(['This is a very long sentence.', 'Next one.'])
  })
})

describe('selectTrack', () => {
  const t = (lang: string, kind: 'manual' | 'asr'): RawTrack => ({ lang, kind, name: lang, baseUrl: 'x' })
  it('ưu tiên người đăng, rồi ASR đúng ngôn ngữ nói', () => {
    // manual khác ngôn ngữ nói < ASR đúng ngôn ngữ nói
    expect(selectTrack([t('ar', 'asr'), t('en', 'asr'), t('vi', 'manual')], 'en', 'auto').lang).toBe('en')
    expect(selectTrack([t('ar', 'asr'), t('vi', 'manual')], undefined, 'auto').lang).toBe('vi')
    expect(selectTrack([t('ar', 'asr'), t('en', 'asr')], audioLangOf('en-US.4'), 'auto').lang).toBe('en')
    expect(selectTrack([t('en', 'asr'), t('en', 'manual')], 'en', 'auto').kind).toBe('manual')
  })
  it('báo lỗi khi chọn ngôn ngữ không có', () => {
    expect(() => selectTrack([t('en', 'asr')], 'en', 'ja')).toThrow(/không có phụ đề/)
    expect(() => selectTrack([], undefined, 'auto')).toThrow(/không có phụ đề/)
  })
})
