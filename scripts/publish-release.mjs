import { execSync } from 'node:child_process'
import { readFileSync, statSync, createReadStream } from 'node:fs'
import { join } from 'node:path'

// 1. Lấy token từ git credential
function getGitHubToken() {
  try {
    const out = execSync('git credential fill', {
      input: 'protocol=https\nhost=github.com\n\n',
      encoding: 'utf8'
    })
    const match = out.match(/^password=(.+)$/m)
    return match ? match[1].trim() : null
  } catch (e) {
    console.error('Không lấy được git credential:', e.message)
    return null
  }
}

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || getGitHubToken()
if (!token) {
  console.error('LỖI: Không tìm thấy GitHub token!')
  process.exit(1)
}

const OWNER = 'NgVietKhoa'
const REPO = 'dual-sub'
const TAG = 'v0.1.0'
const TITLE = 'DualSub 0.1.0'

const BODY = `## Tải về

Tải **DualSub-Setup-0.1.0.exe** bên dưới, mở ra và làm theo hướng dẫn (Windows 10/11, 64-bit).

> ⚠️ Bộ cài chưa được ký số (self-signed) nên Windows có thể hiện *"Windows protected your PC"* — bấm **More info** → **Run anyway**.

Ứng dụng tích hợp sẵn tính năng **Tự động cập nhật**: các phiên bản tiếp theo sẽ tự động thông báo và tải về từ GitHub Releases.

## Có gì trong bản này

- 📺 **Trình phát video song ngữ**: Dán link YouTube, phát video với phụ đề gốc và bản dịch tiếng Việt đồng bộ thời gian thực (5 chế độ phụ đề: Song ngữ, Chỉ gốc, Chỉ dịch, Che bản dịch, Tắt; lặp câu; tốc độ 0.5–1.25×).
- 🎯 **Lấy phụ đề thông minh**: Dùng YouTube.js lấy phụ đề người đăng hoặc ASR, tự động gộp câu hoàn chỉnh và loại bỏ trùng lặp.
- 🌐 **Dịch thuật đa tầng**: Mặc định Google Translate miễn phí theo lô; hỗ trợ thêm DeepL và Claude API trong Cài đặt.
- ⚡ **Bộ nhớ đệm (Cache)**: Lưu transcript và bản dịch trên đĩa, mở lại video tức thì không cần mạng hay dịch lại.
- 📖 **Tra từ điển 1-click**: Bấm từ bất kỳ trong câu đang nói để xem phiên âm IPA, loại từ và nghĩa tiếng Việt (Free Dictionary API + dịch nghĩa).
- 💾 **Lưu từ vựng cá nhân**: Đính kèm câu ví dụ và mốc thời gian; bấm vào từ đã lưu trong tab để xem lại đúng đoạn video đó.
- 🗃️ **Xuất Anki CSV**: Xuất danh sách từ vựng ra file CSV chuẩn UTF-8 BOM, sẵn sàng nhập vào Anki.
- 🎙️ **Whisper AI**: Tích hợp yt-dlp, ffmpeg và whisper.cpp tự động nhận dạng giọng nói ngoại tuyến cho video không có phụ đề.
- 🔄 **Auto-update**: Tích hợp electron-updater tự động kiểm tra và cập nhật khi có bản mới.`

async function main() {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'DualSub-Release-Script'
  }

  console.log(`Đang kiểm tra Release cho tag ${TAG}...`)
  let release
  const getRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/tags/${TAG}`, { headers })
  if (getRes.ok) {
    release = await getRes.json()
    console.log(`Đã tìm thấy release id: ${release.id}`)
  } else {
    console.log(`Đang tạo mới Release ${TITLE} (${TAG})...`)
    const createRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tag_name: TAG,
        name: TITLE,
        body: BODY,
        draft: false,
        prerelease: false
      })
    })
    if (!createRes.ok) {
      const err = await createRes.text()
      throw new Error(`Tạo release thất bại (HTTP ${createRes.status}): ${err}`)
    }
    release = await createRes.json()
    console.log(`Tạo Release thành công! ID: ${release.id}`)
  }

  // Danh sách file cần upload
  const distDir = join(process.cwd(), 'dist')
  const filesToUpload = [
    {
      local: join(distDir, 'DualSub Setup 0.1.0.exe'),
      name: 'DualSub-Setup-0.1.0.exe',
      type: 'application/octet-stream'
    },
    {
      local: join(distDir, 'latest.yml'),
      name: 'latest.yml',
      type: 'text/yaml'
    },
    {
      local: join(distDir, 'DualSub Setup 0.1.0.exe.blockmap'),
      name: 'DualSub-Setup-0.1.0.exe.blockmap',
      type: 'application/octet-stream'
    }
  ]

  // Xoá asset cũ nếu trùng tên
  const existingAssets = release.assets || []
  for (const item of filesToUpload) {
    const dup = existingAssets.find((a) => a.name === item.name)
    if (dup) {
      console.log(`Xoá asset cũ trùng tên: ${item.name} (${dup.id})...`)
      await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/assets/${dup.id}`, {
        method: 'DELETE',
        headers
      })
    }
  }

  // Upload từng asset
  for (const item of filesToUpload) {
    const size = statSync(item.local).size
    console.log(`Đang tải lên ${item.name} (${(size / 1024 / 1024).toFixed(1)} MB)...`)
    const uploadUrl = `https://uploads.github.com/repos/${OWNER}/${REPO}/releases/${release.id}/assets?name=${encodeURIComponent(item.name)}`
    
    const buffer = readFileSync(item.local)
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': item.type,
        'Content-Length': String(size),
        'User-Agent': 'DualSub-Release-Script'
      },
      body: buffer
    })

    if (!uploadRes.ok) {
      const err = await uploadRes.text()
      throw new Error(`Upload ${item.name} thất bại (HTTP ${uploadRes.status}): ${err}`)
    }
    console.log(`✓ Đã tải lên ${item.name} thành công!`)
  }

  console.log(`\n🎉 HOÀN TẤT! Release đã được tạo và đính kèm đầy đủ file tại:`)
  console.log(`👉 https://github.com/${OWNER}/${REPO}/releases/tag/${TAG}`)
}

main().catch((err) => {
  console.error('LỖI:', err)
  process.exit(1)
})
