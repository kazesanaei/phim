'use client'

/**
 * Khung hộp thoại cho chế độ xem nhanh. Đóng bằng Esc, bấm nền, hoặc nút X —
 * đều quay lại đúng chỗ cũ trong lưới nhờ router.back().
 */
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useLayoutEffect, useRef } from 'react'

/**
 * Thẻ phim vừa bấm (D1): hộp thoại nở ra TỪ đúng chỗ tấm poster thay vì hiện
 * giữa màn. Không dùng ViewTransition có tên: thẻ vẫn nằm nguyên trong lưới khi
 * hộp mở (khác với chuyển trang), và một phim có thể nằm ở nhiều hàng cùng lúc
 * — trùng view-transition-name là trình duyệt bỏ cả hiệu ứng. Nên làm FLIP tay:
 * nhớ khung thẻ lúc bấm, hộp mở thì chạy từ khung đó về chỗ thật.
 */
let theVuaBam: { khung: DOMRect; luc: number } | null = null

export function ghiTheVuaBam(e: Element) {
  theVuaBam = { khung: e.getBoundingClientRect(), luc: performance.now() }
}

export default function HopThoai({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const duong = usePathname()
  const oRef = useRef<HTMLDivElement>(null)
  const hopRef = useRef<HTMLDivElement>(null)

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

  useLayoutEffect(() => {
    const the = theVuaBam
    theVuaBam = null
    const hop = hopRef.current
    // Quá 1,5 giây (nguồn chậm) thì thôi: bay từ một tấm thẻ đã cuộn đi mất trông lạc lõng.
    if (!hien || !hop || !the || performance.now() - the.luc > 1500) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const o = hop.getBoundingClientRect()
    const ti = the.khung.width / o.width
    hop.style.animation = 'none'
    hop.animate(
      [
        { transform: `translate(${the.khung.left - o.left}px, ${the.khung.top - o.top}px) scale(${ti})`, opacity: 0.4, borderRadius: '24px' },
        { transform: 'none', opacity: 1, borderRadius: '12px' },
      ],
      { duration: 340, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' },
    )
  }, [hien])

  if (!hien) return null

  return (
    <div
      className="mo-man fixed inset-0 z-[90] overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === oRef.current) router.back()
      }}
      ref={oRef}
    >
      <div ref={hopRef} className="no-hop mx-auto my-8 w-full max-w-3xl origin-top-left overflow-hidden rounded-xl bg-noi shadow-2xl ring-1 ring-white/10">
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
