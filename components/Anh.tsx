'use client'

/**
 * Ảnh của nguồn phim, đi vòng qua `/api/anh` thay vì gọi thẳng CDN.
 *
 * Lý do ở lib/anh.ts: gọi thẳng thì trình duyệt mở quá nhiều kết nối một lúc
 * và nguồn rớt khoảng 15% số ảnh. Ở đây còn thêm hai thứ mắt nhìn thấy được:
 * ô chờ có vệt sáng lúc byte chưa về, và khung có chữ đầu tên khi ảnh chết hẳn
 * — thay cho biểu tượng ảnh vỡ của trình duyệt.
 */
import { useEffect, useRef, useState } from 'react'

/** Bề rộng phải nằm trong danh sách BE_RONG của lib/anh.ts. */
export type BeRongAnh = 200 | 400 | 800 | 1280

const NGOAI = /^https?:\/\//i

/** Đổi URL nguồn thành đường dẫn qua app. Ảnh trong `public/` thì để nguyên. */
export function urlAnh(src: string | undefined | null, rong?: BeRongAnh): string {
  const s = String(src || '').trim()
  // Dữ liệu cũ trong kho có chuỗi rác này ở trường ảnh — đừng bỏ công gọi mạng.
  if (!s || s === '[object Object]') return ''
  if (!NGOAI.test(s)) return s
  return '/api/anh?u=' + encodeURIComponent(s) + (rong ? '&w=' + rong : '')
}

export function KhungChu({ ten, className = '' }: { ten: string; className?: string }) {
  return (
    <div
      className={`grid h-full w-full place-items-center bg-gradient-to-br from-[var(--color-nen-2)] to-black text-3xl font-black text-white/15 ${className}`}
    >
      {ten.trim().charAt(0).toUpperCase() || '?'}
    </div>
  )
}

export default function Anh({
  src,
  alt = '',
  rong,
  className = '',
  /** Có chuỗi thì ảnh hỏng sẽ vẽ khung chữ cái đầu; không có thì hỏng là biến mất. */
  duPhong,
  /** Vẽ ô chờ phủ kín — chỉ bật khi thẻ cha đã `relative`. */
  khungCho = false,
  uuTien = false,
  anAnToan = false,
}: {
  src?: string | null
  alt?: string
  rong?: BeRongAnh
  className?: string
  duPhong?: string
  khungCho?: boolean
  /** Ảnh trong khung nhìn đầu tiên (banner) — tải ngay, không lười. */
  uuTien?: boolean
  /** Ảnh trang trí thuần tuý, giấu khỏi trình đọc màn hình. */
  anAnToan?: boolean
}) {
  /**
   * Mặc định là 'xong' chứ KHÔNG phải 'cho'. Hai cái bẫy, đều gặp thật:
   *
   * 1. Thẻ img do máy chủ dựng, nên ảnh có sẵn trong bộ đệm tải xong TRƯỚC khi
   *    React gắn `onLoad` — sự kiện bắn vào khoảng không.
   * 2. Nếu trạng thái đầu là 'cho' và ảnh bị giấu cho tới khi `onLoad` chạy,
   *    thì suốt quãng chưa hydrate MỌI ảnh đều vô hình. Trên TV Box yếu đó là
   *    cả lưới trắng một nhịp — tệ hơn hẳn cái mình định sửa.
   *
   * Nên: máy chủ dựng ra ảnh nhìn thấy được ngay, hiệu ứng hiện dần làm bằng
   * CSS thuần. JS chỉ thêm hai việc: đắp ô chờ khi ảnh THẬT SỰ đang tải, và
   * đổi sang khung dự phòng khi ảnh chết.
   */
  const [trangThai, datTrangThai] = useState<'cho' | 'xong' | 'hong'>('xong')
  const oRef = useRef<HTMLImageElement>(null)
  const dich = urlAnh(src, rong)

  useEffect(() => {
    const e = oRef.current
    if (!e) return
    if (!e.complete) return datTrangThai('cho')
    datTrangThai(e.naturalWidth > 0 ? 'xong' : 'hong')
  }, [dich])

  if (!dich || trangThai === 'hong') {
    return duPhong !== undefined ? <KhungChu ten={duPhong} /> : null
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={oRef}
        src={dich}
        alt={alt}
        aria-hidden={anAnToan || undefined}
        loading={uuTien ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => datTrangThai('xong')}
        onError={() => datTrangThai('hong')}
        className={`anh-hien ${className}`}
      />
      {/* Vẽ SAU thẻ img và có position nên nằm đè lên trên, che đúng lúc đang tải. */}
      {khungCho && trangThai === 'cho' && (
        <span aria-hidden className="o-cho pointer-events-none absolute inset-0 overflow-hidden bg-[var(--color-nen-2)]" />
      )}
    </>
  )
}
