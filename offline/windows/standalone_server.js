const path = require('path')
const http = require('http')
const fs = require('fs')

const dir = path.resolve(__dirname)

process.env.NODE_ENV = 'production'
process.chdir(dir)

const currentPort = parseInt(process.env.PORT, 10) || 3456
const internalPort = currentPort + 100
const hostname = process.env.HOSTNAME || '127.0.0.1'

let keepAliveTimeout = parseInt(process.env.KEEP_ALIVE_TIMEOUT, 10)
if (Number.isNaN(keepAliveTimeout) || !Number.isFinite(keepAliveTimeout) || keepAliveTimeout < 0) {
  keepAliveTimeout = undefined
}

// 1. Read the full, complete Next.js configuration from required-server-files.json
const reqFilesPath = path.join(dir, '.next', 'required-server-files.json')
let nextConfig = {}
if (fs.existsSync(reqFilesPath)) {
  try {
    const raw = fs.readFileSync(reqFilesPath, 'utf8')
    const parsed = JSON.parse(raw)
    nextConfig = parsed.config || {}
  } catch (e) {
    console.error('[Sastmhaly] Failed to parse required-server-files.json:', e)
  }
}

// Ensure experimental object exists so Next.js base-server does not throw
if (!nextConfig.experimental) {
  nextConfig.experimental = {}
}
if (!nextConfig.experimental.instantInsights) {
  nextConfig.experimental.instantInsights = { validationLevel: 'warning' }
}

// Dynamically override any hardcoded developer machine paths with the current device installation directory
nextConfig.outputFileTracingRoot = dir
if (nextConfig.turbopack) nextConfig.turbopack.root = dir
nextConfig.repoRoot = dir

process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(nextConfig)

// Patch required-server-files.json on disk to avoid any discrepancy
try {
  if (fs.existsSync(reqFilesPath)) {
    const raw = fs.readFileSync(reqFilesPath, 'utf8')
    const parsed = JSON.parse(raw)
    parsed.config = nextConfig
    parsed.appDir = dir
    fs.writeFileSync(reqFilesPath, JSON.stringify(parsed, null, 2))
  }
} catch (e) {
  // non-fatal
}

require('next')
const { startServer } = require('next/dist/server/lib/start-server')

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.txt': 'text/plain; charset=utf-8'
}

function serveStatic(filePath, res) {
  try {
    const normalized = path.normalize(filePath)
    if (!fs.existsSync(normalized)) return false
    const stat = fs.statSync(normalized)
    if (!stat.isFile()) return false

    const ext = path.extname(normalized).toLowerCase()
    const mime = MIME_TYPES[ext] || 'application/octet-stream'
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': stat.size,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff'
    })
    fs.createReadStream(normalized).pipe(res)
    return true
  } catch (err) {
    return false
  }
}

// Start Next.js on internalPort
startServer({
  dir,
  isDev: false,
  config: nextConfig,
  hostname: '127.0.0.1',
  port: internalPort,
  allowRetry: false,
  keepAliveTimeout,
}).then(() => {
  console.log(`[Next.js Internal] Running on http://127.0.0.1:${internalPort}`)

  // Start the outer Gateway server that intercepts static files and proxies dynamic routes
  const gateway = http.createServer((req, res) => {
    const rawUrl = req.url || '/'
    let pathname = rawUrl.split('?')[0]
    try {
      pathname = decodeURIComponent(pathname)
    } catch (e) {
      // fallback to raw
    }

    // 1. Direct local static file serving for /_next/static/*
    if (pathname.startsWith('/_next/static/')) {
      const relPath = pathname.slice('/_next/static/'.length)
      const diskPath = path.join(dir, '.next', 'static', relPath)
      if (serveStatic(diskPath, res)) return
    }

    // 2. Direct local static file serving for public/* files
    if (pathname !== '/' && pathname.indexOf('..') === -1) {
      const publicPath = path.join(dir, 'public', pathname.startsWith('/') ? pathname.slice(1) : pathname)
      if (serveStatic(publicPath, res)) return
    }

    // 3. Forward dynamic page requests and API calls to internal Next.js
    const proxyReq = http.request({
      hostname: '127.0.0.1',
      port: internalPort,
      path: req.url,
      method: req.method,
      headers: req.headers
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers)
      proxyRes.pipe(res)
    })

    proxyReq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('جاري تجهيز النظام... يُرجى الانتظار ثوانٍ قليلة ثم إعادة المحاولة.')
    })

    req.pipe(proxyReq)
  })

  gateway.listen(currentPort, hostname, () => {
    console.log(`[Sastmhaly POS] Ready and listening on http://${hostname}:${currentPort}`)
  })
}).catch((err) => {
  console.error('[Sastmhaly POS Fatal Error]:', err)
  process.exit(1)
})
