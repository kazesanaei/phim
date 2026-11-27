'use client'

/**
 * Dải tab dính dưới đầu trang ở trang phim. Là neo cuộn (#tap, #dien-vien...)
 * chứ không ẩn/hiện bảng: TV đi bằng phím mũi tên xuống là lần lượt qua hết,
 * không phải bấm tab mới thấy nội dung. Tab sáng theo phần đang nằm trong khung.
 */
import { useEffect, useState } from 'react'

export default function TabTrang({ tab }: { tab: { id: string; nhan: string }[] }) {
  const [dang, datDang] = useState(tab[0]?.id)

  useEffect(() => {
    const quan = new IntersectionObserver(
      (ds) => {
        const thay = ds.filter((d) => d.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (thay) datDang(thay.target.id)
      },
      // Chỉ tính dải ngay dưới tab: phần nào chạm dải này là phần đang đọc.
      { rootMargin: '-120px 0px -60% 0px' },
    )
    for (const t of tab) {
      const e = document.getElementById(t.id)
      if (e) quan.observe(e)
    }
    return () => quan.disconnect()
  }, [tab])

  return (
    <nav className="tab-trang sticky top-14 z-30 -mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-white/10 bg-[var(--color-nen)]/90 px-4 backdrop-blur an-cuon">
      {tab.map((t) => (
        <a
          key={t.id}
          href={'#' + t.id}
          aria-current={dang === t.id ? 'true' : undefined}
          className={`relative shrink-0 px-3 py-3 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-white ${
            dang === t.id ? 'text-white' : 'text-white/55 hover:text-white'
          }`}
        >
          {t.nhan}
          <span
            aria-hidden
            className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[var(--color-nhan)] transition-transform duration-300 ${
              dang === t.id ? 'scale-x-100' : 'scale-x-0'
            }`}
          />
        </a>
      ))}
    </nav>
  )
}
