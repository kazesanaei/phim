'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'

type TapTom = { ten: string; slug: string; embed: string }

export default function NutTaiVe({
  slug,
  ten,
  poster,
  tap,
}: {
  slug: string
  ten: string
  poster?: string
  tap: TapTom[]
}) {
  const [mo, datMo] = useState(false)
  const [tin, datTin] = useState<string | null>(null)
  const [dangChay, batDau] = useTransition()
  const nhieuTap = tap.length > 1

  function gui(ds: TapTom[]) {
    batDau(async () => {
      const r = await fetch('/api/tai-ve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          viec: 'them',
          ds: ds.map((t) => ({
            phimSlug: slug,
            tapSlug: t.slug,
            tenHien: nhieuTap ? `${ten} - Tap ${t.ten}` : ten,
            embed: t.embed,
            poster,
          })),
        }),
      })
      const j = await r.json()
      datTin(r.ok ? `Đã xếp ${j.them} mục vào hàng đợi` : j.loi || 'Không xếp được')
      datMo(false)
      setTimeout(() => datTin(null), 6000)
    })
  }

  return (
    <div className="relative">
      <button
        disabled={dangChay}
        onClick={() => (nhieuTap ? datMo((m) => !m) : gui(tap))}
        className="flex items-center gap-2 rounded bg-white/10 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/20 disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
          <path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z" />
        </svg>
        {dangChay ? 'Đang xếp...' : 'Tải về'}
      </button>

      {mo && (
        <div className="absolute left-0 top-full z-30 mt-2 w-64 rounded-lg bg-neutral-900 p-2 text-sm shadow-xl ring-1 ring-white/10">
          <button
            onClick={() => gui(tap)}
            className="w-full rounded px-3 py-2 text-left hover:bg-white/10"
          >
            Tải cả bộ ({tap.length} tập)
          </button>
          <div className="mt-1 max-h-56 overflow-y-auto border-t border-white/10 pt-1">
            {tap.map((t) => (
              <button
                key={t.slug}
                onClick={() => gui([t])}
                className="w-full rounded px-3 py-1.5 text-left text-white/70 hover:bg-white/10 hover:text-white"
              >
                Tập {t.ten}
              </button>
            ))}
          </div>
        </div>
      )}

      {tin && (
        <p className="absolute left-0 top-full mt-2 whitespace-nowrap rounded bg-black/90 px-3 py-1.5 text-xs text-white/80">
          {tin} ·{' '}
          <Link href="/tai-ve" className="underline underline-offset-2">
            Xem hàng đợi
          </Link>
        </p>
      )}
    </div>
  )
}
