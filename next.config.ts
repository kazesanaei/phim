import type { NextConfig } from 'next'

// Poster và ảnh nền lấy thẳng từ CDN vsmov; video/phụ đề đi qua proxy same-origin
// (/api/tep) nên chỉ cần 'self'. Playlist blob của hls.js cần blob:. Không dùng
// unsafe-inline cho script; style thì Next tiêm inline nên phải cho unsafe-inline.
const CSP = [
  "default-src 'self'",
  "img-src 'self' data: https://vsmov.com",
  "media-src 'self' blob:",
  "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''),
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  // hls.js chạy Web Worker tạo từ blob: khi enableWorker — không cho thì nó
  // phải chạy demux trên main thread, tua giật hơn.
  "worker-src blob:",
  "child-src blob:",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ')

const nextConfig: NextConfig = {
  /**
   * `proxy.ts` import lib/db.ts, nên Turbopack truy vết cả thư mục dữ liệu và
   * cố đọc `phim.db-shm` — file WAL đang bị server khoá, build gãy với
   * "The process cannot access the file... (os error 33)".
   * Dữ liệu chạy thì đọc lúc chạy, không việc gì phải gói vào bản build.
   */
  outputFileTracingExcludes: {
    '*': ['./du-lieu/**', './public/tua/**', './public/poster/**'],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: CSP },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ]
  },
}

export default nextConfig
