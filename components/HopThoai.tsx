'use client'

/**
 * Khung hộp thoại cho chế độ xem nhanh. Đóng bằng Esc, bấm nền, hoặc nút X —
 * đều quay lại đúng chỗ cũ trong lưới nhờ router.back().
 */
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

export default function HopThoai({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const duong = usePathname()
  const oRef = useRef<HTMLDivElement>(null)

  /**
   * TỰ ĐÓNG KHI ĐƯỜNG DẪN KHÔNG CÒN LÀ TRANG PHIM NỮA.
   *
   * Next giữ nguyên nội dung cũ của khe route song song (`@modal`) khi điều
   * hướng MỀM; `default.tsx` chỉ có tác dụng lúc tải lại cả trang. Nên bấm
   * "Xem ngay" là URL sang `/xem/...`, trình phát nạp xong ở dưới, mà hộp thoại
   * vẫn nằm đè lên trên — người xem bấm mãi không thấy phim chạy, tưởng treo.
   *
   * Đã đo: trong 4 đường ra khỏi hộp thoại chỉ 1 cái chạy đúng (nút X, vì nó
   * gọi router.back()). "Xem ngay", "Xem đầy đủ" và cả bấm menu Trang chủ đều
   * để hộp thoại kẹt lại.
   *
   * Chốt theo đường dẫn chữa mọi lối đi TỚI (kể cả link thêm sau này). Riêng
   * hai link trỏ về đúng `/phim/<slug>` đang mở thì đường dẫn không đổi nên
   * chốt này không bắt được — chúng dùng thẻ <a> thường để tải lại hẳn trang.
   */
  const hien = !!duong?.startsWith('/phim/')

  useEffect(() => {
    if (!hien) return
    const f = (e: KeyboardEvent) => {
      if (e.key === 'Escape') router.back()
    }
    document.addEventListener('keydown', f)
    // Khoá cuộn nền để hộp thoại không trôi theo trang phía sau
    const cu = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', f)
      document.body.style.overflow = cu
    }
  }, [router, hien])

  if (!hien) return null

  return (
    <div
      className="mo-man fixed inset-0 z-[90] overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === oRef.current) router.back()
      }}
      ref={oRef}
    >
      <div className="no-hop mx-auto my-8 w-full max-w-3xl overflow-hidden rounded-xl bg-[#181818] shadow-2xl ring-1 ring-white/10">
        <div className="relative">
          <button
            onClick={() => router.back()}
            aria-label="Đóng"
            className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/70 text-white/80 transition hover:bg-black hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z" />
            </svg>
          </button>
          {children}
        </div>
      </div>
    </div>
  )
}
