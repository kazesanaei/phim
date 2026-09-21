/**
 * Poster đi qua đây thay vì để trình duyệt đập thẳng vào CDN nguồn.
 * Lý do, cách chống rớt kết nối và cách thu nhỏ: xem chú thích đầu lib/anh.ts.
 */
import { hopLe, layAnh, locBeRong } from '@/lib/anh'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Ảnh ở nguồn không đổi nội dung theo URL nên cho trình duyệt giữ thật lâu. */
const DEM_TRINH_DUYET = 'public, max-age=604800, stale-while-revalidate=86400, immutable'

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const u = sp.get('u')
  if (!u || !hopLe(u)) {
    return new Response('URL ảnh không hợp lệ', { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }

  const kq = await layAnh(u, locBeRong(sp.get('w')))
  if (!kq) {
    // Ảnh chết thật ở nguồn. 404 để thẻ <img> chạy nhánh onError của nó và
    // components/Anh.tsx vẽ khung chữ cái đầu thay cho ảnh vỡ.
    return new Response('Không lấy được ảnh', { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }

  return new Response(new Uint8Array(kq.than), {
    headers: {
      'Content-Type': kq.kieu,
      'Content-Length': String(kq.than.length),
      'Cache-Control': DEM_TRINH_DUYET,
      'X-Nguon-Anh': kq.tuDia ? 'dia' : 'mang',
    },
  })
}
