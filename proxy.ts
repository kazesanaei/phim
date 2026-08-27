/**
 * Cửa xác thực cho chế độ LAN.
 *
 * Next 16 đổi tên `middleware.ts` thành `proxy.ts`, VÀ nó mặc định chạy Node.js
 * runtime — nhờ vậy đọc thẳng được SQLite để biết đã bật chế độ LAN chưa. Với
 * middleware edge của các bản trước thì không làm được như thế này.
 *
 * Không bật chế độ LAN (mặc định, chỉ nghe 127.0.0.1) thì hàm này cho qua hết.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { daQuaCua } from '@/lib/xac-thuc'

// Những đường không được chặn, nếu không sẽ lặp vô hạn hoặc vỡ giao diện.
const CHO_QUA = ['/dang-nhap', '/api/dang-nhap', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']

export async function proxy(req: NextRequest) {
  const duong = req.nextUrl.pathname
  if (CHO_QUA.some((d) => duong === d || duong.startsWith(d + '/'))) return NextResponse.next()

  if (await daQuaCua()) return NextResponse.next()

  // API trả 401 để phía client biết mà xử lý, không chuyển hướng lung tung.
  if (duong.startsWith('/api/')) {
    return NextResponse.json({ loi: 'Chưa đăng nhập' }, { status: 401 })
  }

  const den = new URL('/dang-nhap', req.url)
  return NextResponse.redirect(den)
}

export const config = {
  // Bỏ qua tài nguyên tĩnh của Next và ảnh poster đã trích ra.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|poster/).*)'],
}
