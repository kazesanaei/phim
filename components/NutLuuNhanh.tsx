'use client'

/**
 * Nút lưu vào "Xem sau" đặt ngay trên thẻ phim.
 *
 * VÌ SAO CẦN: bảng `danh_dau` có 0 dòng dù tính năng đã làm xong từ lâu — vì
 * lối duy nhất để lưu là MỞ TRANG CHI TIẾT rồi mới bấm được. Ba thao tác cho
 * một việc đáng lẽ một. Các trang phim lớn đều để nút ngay trên thẻ.
 *
 * Trạng thái lấy từ kho chung (components/dung-danh-dau.ts): một lượt gọi cho
 * cả trang, không phải mỗi thẻ một lượt.
 */
import { useTransition } from 'react'
import { datDanhDau, dungDanhDau } from '@/components/dung-danh-dau'
import type { PhimTom } from '@/lib/vsmov'

export default function NutLuuNhanh({ phim, ten }: { phim: PhimTom; ten: string }) {
  const bat = dungDanhDau(phim.slug)
  const [dangChay, batDau] = useTransition()

  function bam(e: React.MouseEvent) {
    // Nút nằm ĐÈ LÊN link mở phim, không chặn thì bấm lưu lại nhảy sang trang.
    e.preventDefault()
    e.stopPropagation()
    batDau(async () => {
      try {
        const r = await fetch('/api/xem', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            viec: 'danh-dau',
            khoa: phim.slug,
            loai: 'xem_sau',
            ten,
            poster: phim.poster,
            nam: phim.nam,
            nguon: phim.nguon,
          }),
        })
        const j = await r.json()
        if (typeof j.bat === 'boolean') datDanhDau(phim.slug, j.bat)
      } catch {
        // Mất mạng: không đổi trạng thái, người dùng bấm lại là xong.
      }
    })
  }

  const daLuu = bat === true

  return (
    <button
      onClick={bam}
      disabled={dangChay}
      aria-pressed={daLuu}
      title={daLuu ? 'Bỏ khỏi Xem sau' : 'Lưu vào Xem sau'}
      aria-label={daLuu ? `Bỏ ${ten} khỏi Xem sau` : `Lưu ${ten} vào Xem sau`}
      /* `nut-luu`: trên máy tính chỉ hiện khi rê chuột lên thẻ cho đỡ rối;
         ở chế độ TV thì hiện luôn, vì không có "rê chuột" để mà lộ ra.
         Quy tắc hiện/ẩn nằm trong app/globals.css. */
      className={`nut-luu absolute right-1.5 top-1.5 z-10 grid h-8 w-8 place-items-center rounded-full backdrop-blur transition disabled:opacity-50 ${
        daLuu ? 'bg-white text-black' : 'bg-black/60 text-white hover:bg-black/80'
      }`}
    >
      <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-current">
        {daLuu ? <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" /> : <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" />}
      </svg>
    </button>
  )
}
