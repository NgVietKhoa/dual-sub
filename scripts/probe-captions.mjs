import { Innertube } from 'youtubei.js'

const id = process.argv[2]
const yt = await Innertube.create({ retrieve_player: false })
const info = await yt.getBasicInfo(id, { client: 'ANDROID' })
const c = info.captions
console.log('default_audio_track_index', c?.default_audio_track_index, JSON.stringify(c?.audio_tracks))
const tracks = c?.caption_tracks ?? []
const lang = process.argv[3] ?? 'en'
const t = tracks.find((x) => x.language_code === lang) ?? tracks[0]
const url = new URL(t.base_url)
url.searchParams.set('fmt', 'json3')
const body = await (await fetch(url)).json()
console.log(t.language_code, 'events', body.events.length)
console.log(JSON.stringify(body.events.slice(0, 8)))
