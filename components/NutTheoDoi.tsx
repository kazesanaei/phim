'use client'

import { useState, useTransition } from 'react'

/** Theo dõi phim bộ để được báo khi có tập mới. */
export default function NutTheoDoi({
  slug,
  ten,
  poster,
  tapHienTai,
  banDau,
}: {
  slug: string
  ten: string
  poster?: string
  tapHienTai?: string
  banDau: boolean
}) {
  const [bat, datBat] = useState(banDau)
  const [dangChay, batDau] = useTransition()

  return (
    <button
      disabled={dangChay}
      title={bat ? 'Bỏ theo dõi' : 'Báo cho tôi khi có tập mới'}
      onClick={() =>
        batDau(async () => {
          const r = await fetch('/api/xem', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ viec: 'theo-doi', slug, ten, poster, tapHienTai }),
          })
          const j = await r.json()
          if (typeof j.bat === 'boolean') datBat(j.bat)
        })
      }
      className={`flex items-center gap-2 rounded px-4 py-2.5 text-sm font-medium transition disabled:opacity-60 ${
        bat ? 'bg-white/25 text-white' : 'bg-white/10 text-white/80 hover:bg-white/20'
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
        {bat ? (
          <path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6v-5a6 6 0 0 0-4.5-5.8V4a1.5 1.5 0 0 0-3 0v1.2A6 6 0 0 0 6 11v5l-2 2v1h16v-1z" />
        ) : (
          <path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6v-5a6 6 0 0 0-4.5-5.8V4a1.5 1.5 0 0 0-3 0v1.2A6 6 0 0 0 6 11v5l-2 2v1h16v-1zm-2 1H8v-6a4 4 0 0 1 8 0z" />
        )}
      </svg>
      {bat ? 'Đang theo dõi' : 'Theo dõi'}
    </button>
  )
}
