'use client'

import Link from 'next/link'
import { useRef } from 'react'

/**
 * Hàng phim cuộn ngang. Là client component chỉ vì hai nút mũi tên; thẻ phim
 * bên trong vẫn do máy chủ dựng và truyền vào qua children.
 */
export default function HangPhim({
  tieuDe,
  xemThem,
  children,
}: {
  tieuDe: string
  xemThem?: string
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  const cuon = (huong: number) => {
    const e = ref.current
    if (e) e.scrollBy({ left: huong * e.clientWidth * 0.85, behavior: 'smooth' })
  }

  return (
    <section className="hang-phim group/hang relative py-3">
      <div className="mb-2 flex items-baseline gap-3 px-4">
        <h2 className="text-base font-semibold">{tieuDe}</h2>
        {xemThem && (
          <Link href={xemThem} className="text-xs text-white/40 transition hover:text-white">
            Xem tất cả
          </Link>
        )}
      </div>

      <div className="relative">
        <div
          ref={ref}
          className="an-cuon flex snap-x gap-3 overflow-x-auto scroll-smooth px-4 pb-1"
        >
          {children}
        </div>

        <NutCuon huong={-1} onClick={() => cuon(-1)} />
        <NutCuon huong={1} onClick={() => cuon(1)} />
      </div>
    </section>
  )
}

function NutCuon({ huong, onClick }: { huong: -1 | 1; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={huong < 0 ? 'Cuộn sang trái' : 'Cuộn sang phải'}
      /* Nút cuộn là thứ dành cho chuột. Ở chế độ TV nó hút hết tiêu điểm: bấm
         Phải ở cuối hàng là rơi vào đây rồi kẹt luôn, không quay lại được.
         Có remote thì hàng tự cuộn theo tiêu điểm nên nút này thừa. */
      data-nut-chuot="1"
      className={`absolute top-0 hidden h-full w-10 items-center justify-center bg-gradient-to-r from-black/80 to-transparent text-white/80 opacity-0 transition group-hover/hang:opacity-100 hover:text-white md:flex ${
        huong < 0 ? 'left-0' : 'right-0 rotate-180'
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current">
        <path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4-4.6-4.6z" />
      </svg>
    </button>
  )
}
