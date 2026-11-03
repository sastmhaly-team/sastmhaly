const path = require('path')
const http = require('http')
const fs = require('fs')

const dir = path.join(__dirname)

process.env.NODE_ENV = 'production'
process.chdir(__dirname)

const currentPort = parseInt(process.env.PORT, 10) || 3456
const internalPort = currentPort + 100
const hostname = process.env.HOSTNAME || '127.0.0.1'

let keepAliveTimeout = parseInt(process.env.KEEP_ALIVE_TIMEOUT, 10)
const nextConfig = {"env":{},"webpack":null,"typescript":{"ignoreBuildErrors":false},"typedRoutes":false,"distDir":"./.next","cleanDistDir":true,"assetPrefix":"","cacheMaxMemorySize":52428800,"configOrigin":"next.config.ts","useFileSystemPublicRoutes":true,"generateEtags":true,"pageExtensions":["tsx","ts","jsx","js"],"instrumentationClientInject":[],"poweredByHeader":true,"compress":true,"images":{"deviceSizes":[640,750,828,1080,1200,1920,2048,3840],"imageSizes":[32,48,64,96,128,256,384],"path":"/_next/image","loader":"default","loaderFile":"","domains":[],"disableStaticImages":false,"minimumCacheTTL":14400,"formats":["image/webp"],"maximumRedirects":3,"maximumResponseBody":50000000,"dangerouslyAllowLocalIP":false,"dangerouslyAllowSVG":false,"contentSecurityPolicy":"script-src 'none'; frame-src 'none'; sandbox;","contentDispositionType":"attachment","localPatterns":[{"pathname":"**","search":""}],"remotePatterns":[],"qualities":[75],"unoptimized":false,"customCacheHandler":false},"devIndicators":{"position":"bottom-left"},"onDemandEntries":{"maxInactiveAge":60000,"pagesBufferLength":5},"basePath":"","sassOptions":{},"trailingSlash":false,"i18n":null,"productionBrowserSourceMaps":false,"excludeDefaultMomentLocales":true,"reactProductionProfiling":false,"reactStrictMode":null,"reactMaxHeadersLength":6000,"httpAgentOptions":{"keepAlive":true},"logging":{"serverFunctions":true,"browserToTerminal":"warn"},"compiler":{},"expireTime":31536000,"staticPageGenerationTimeout":60,"output":"standalone","modularizeImports":{"@mui/icons-material":{"transform":"@mui/icons-material/{{member}}"},"lodash":{"transform":"lodash/{{member}}"}},"outputFileTracingRoot":dir,"enablePrerenderSourceMaps":true,"cacheComponents":true,"serverExternalPackages":["better-sqlite3"],"partialPrefetching":true,"turbopack":{"rules":{"*.css":{"loaders":["@tailwindcss/turbopack"],"as":"*.css"}},"root":dir},"repoRoot":dir,"distDirRoot":".next","supportsImmutableAssets":false}

// Dynamically override any hardcoded developer machine paths with the current device installation directory
nextConfig.outputFileTracingRoot = dir
if (nextConfig.turbopack) nextConfig.turbopack.root = dir
nextConfig.repoRoot = dir

process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(nextConfig)

// Patch required-server-files.json in memory and on disk
try {
  const reqFilesPath = path.join(dir, '.next', 'required-server-files.json')
  if (fs.existsSync(reqFilesPath)) {
    const raw = fs.readFileSync(reqFilesPath, 'utf8')
    const parsed = JSON.parse(raw)
    parsed.config.outputFileTracingRoot = dir
    if (parsed.config.turbopack) parsed.config.turbopack.root = dir
    parsed.config.repoRoot = dir
    parsed.appDir = dir
    fs.writeFileSync(reqFilesPath, JSON.stringify(parsed, null, 2))
  }
} catch (e) {
  // non-fatal
}

require('next')
const { startServer } = require('next/dist/server/lib/start-server')

if (
  Number.isNaN(keepAliveTimeout) ||
  !Number.isFinite(keepAliveTimeout) ||
  keepAliveTimeout < 0
) {
  keepAliveTimeout = undefined
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
}

function serveStatic(filePath, res) {
  try {
    if (!fs.existsSync(filePath)) return false
    const stat = fs.statSync(filePath)
    if (!stat.isFile()) return false

    const ext = path.extname(filePath).toLowerCase()
    const mime = MIME_TYPES[ext] || 'application/octet-stream'
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': stat.size,
      'Cache-Control': 'public, max-age=31536000, immutable'
    })
    fs.createReadStream(filePath).pipe(res)
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
  // Start the outer server that serves static files directly from local device disk!
  const gateway = http.createServer((req, res) => {
    const rawUrl = req.url || '/'
    const pathname = rawUrl.split('?')[0]

    // 1. Direct local static file serving for /_next/static/
    if (pathname.startsWith('/_next/static/')) {
      const relPath = pathname.slice('/_next/static/'.length)
      const diskPath = path.join(dir, '.next', 'static', relPath)
      if (serveStatic(diskPath, res)) return
    }

    // 2. Direct local static file serving for public/
    if (pathname !== '/' && pathname.indexOf('..') === -1) {
      const publicPath = path.join(dir, 'public', pathname.startsWith('/') ? pathname.slice(1) : pathname)
      if (serveStatic(publicPath, res)) return
    }

    // 3. Forward dynamic page requests and API calls to Next.js
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
      res.end('Sastmhaly Server Initializing... Please wait a moment and refresh.')
    })

    req.pipe(proxyReq)
  })

  gateway.listen(currentPort, hostname, () => {
    console.log(`[Sastmhaly POS] Ready and listening on http://${hostname}:${currentPort}`)
  })
}).catch((err) => {
  console.error(err)
  process.exit(1)
})
