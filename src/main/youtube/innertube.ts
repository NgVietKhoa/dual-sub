import type { Innertube, YT, Types } from 'youtubei.js'

/**
 * youtubei.js (v18) là gói ESM. Nạp bằng import() động để chạy được trong main process (CJS).
 * Các API dùng: Innertube.create(), innertube.getBasicInfo(videoId, { client }),
 * info.basic_info, info.playability_status, info.captions (PlayerCaptionsTracklist).
 */
let instance: Promise<Innertube> | null = null

export function getInnertube(): Promise<Innertube> {
  instance ??= (async () => {
    const mod = await import('youtubei.js')
    // Tắt log nội bộ của thư viện (parser hay in cảnh báo dài, không ảnh hưởng kết quả)
    mod.Log?.setLevel(mod.Log.Level.NONE)
    return mod.Innertube.create({ retrieve_player: false })
  })().catch((e) => {
    instance = null
    throw e
  })
  return instance
}

/**
 * Client WEB/TV hiện trả UNPLAYABLE nếu thiếu PO token; ANDROID/IOS vẫn trả caption tracks
 * kèm URL tải được. Thử lần lượt.
 */
export const CLIENTS: Types.InnerTubeClient[] = ['ANDROID', 'IOS', 'WEB']

export async function getVideoInfo(
  videoId: string,
  client: Types.InnerTubeClient
): Promise<YT.VideoInfo> {
  const yt = await getInnertube()
  return yt.getBasicInfo(videoId, { client })
}

