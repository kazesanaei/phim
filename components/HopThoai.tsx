'use client'

/**
 * Khung hộp thoại cho chế độ xem nhanh. Đóng bằng Esc, bấm nền, hoặc nút X —
 * đều quay lại đúng chỗ cũ trong lưới nhờ router.back().
 */
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

export default function HopThoai({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const oRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
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
  }, [router])

  return (
    <div
      className="fixed inset-0 z-[90] overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === oRef.current) router.back()
      }}
      ref={oRef}
    >
      <div className="mx-auto my-8 w-full max-w-3xl overflow-hidden rounded-xl bg-[#181818] shadow-2xl ring-1 ring-white/10">
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
