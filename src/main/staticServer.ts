import { createServer, type Server } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.map': 'application/json'
}

export interface StaticServer {
  origin: string
  close(): void
}

/** Server tĩnh chỉ lắng nghe 127.0.0.1, phục vụ renderer đã build (để YouTube có origin http hợp lệ). */
export function startStaticServer(root: string, preferredPort = 47831): Promise<StaticServer> {
  const server: Server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent((req.url ?? '/').split('?')[0])
      const rel = normalize(pathname === '/' ? '/index.html' : pathname)
      const file = join(root, rel)
      if (!file.startsWith(root + sep) && file !== root) {
        res.writeHead(403).end()
        return
      }
      const data = await readFile(file)
      res.writeHead(200, {
        'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
        'Cache-Control': 'no-cache'
      })
      res.end(data)
    } catch {
      res.writeHead(404).end('Not found')
    }
  })

  const listen = (port: number): Promise<number> =>
    new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(port, '127.0.0.1', () => {
        server.off('error', reject)
        const addr = server.address()
        resolve(typeof addr === 'object' && addr ? addr.port : port)
      })
    })

  return listen(preferredPort)
    .catch(() => listen(0))
    .then((port) => ({
      origin: `http://127.0.0.1:${port}`,
      close: () => server.close()
    }))
}

