import Link from 'next/link'
import { tienDoCuaPhim } from '@/lib/theo-doi'
import type { Tap } from '@/lib/vsmov'

export default function DanhSachTap({
  slug,
  tap,
  dangXem,
  server,
}: {
  slug: string
  tap: Tap[]
  dangXem?: string
  server: number
}) {
  const daXem = tienDoCuaPhim(slug)

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2">
      {tap.map((t) => {
        const g = daXem.get(`${slug}:${t.slug}`)
        const phanTram = g && g.thoi_luong ? Math.min(100, (g.vi_tri / g.thoi_luong) * 100) : 0
        const dang = t.slug === dangXem
        return (
          <Link
            key={t.slug}
            href={`/xem/${slug}?tap=${t.slug}&server=${server}`}
            title={g?.xong ? 'Đã xem xong' : phanTram ? `Đang xem ${Math.round(phanTram)}%` : undefined}
            className={`relative overflow-hidden rounded px-2 py-2 text-center text-sm transition ${
              dang
                ? 'bg-[var(--color-nhan)] font-semibold text-white'
                : g?.xong
                  ? 'bg-[var(--color-nen-2)] text-white/35 hover:text-white'
                  : 'bg-[var(--color-nen-2)] text-white/75 hover:bg-white/15 hover:text-white'
            }`}
          >
            {t.ten}
            {!dang && phanTram > 0 && !g?.xong && (
              <span
                className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--color-nhan)]"
                style={{ width: phanTram + '%' }}
              />
            )}
          </Link>
        )
      })}
    </div>
  )
}
