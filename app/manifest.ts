import type { MetadataRoute } from 'next'

/**
 * Cho phép cài như ứng dụng riêng (mở từ màn hình nền, không thanh địa chỉ).
 * KHÔNG có service worker: nội dung phim nằm trên mạng hoặc trên ổ đĩa qua
 * server này, nên chạy offline là vô nghĩa — thêm SW chỉ tổ gây rắc rối cache.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Kho phim',
    short_name: 'Kho phim',
    description: 'Trang xem phim cá nhân chạy trên máy',
    start_url: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0b0b0f',
    theme_color: '#0b0b0f',
    lang: 'vi',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
