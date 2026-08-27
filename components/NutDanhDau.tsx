'use client'

import { useState, useTransition } from 'react'

type Props = {
  khoa: string
  loai: 'thich' | 'xem_sau'
  banDau: boolean
  ten: string
  poster?: string
  nam?: number
  nguon: string
}

const NHAN = {
  thich: { bat: 'Đã thích', tat: 'Yêu thích' },
  xem_sau: { bat: 'Trong danh sách', tat: 'Xem sau' },
}

export default function NutDanhDau({ khoa, loai, banDau, ten, poster, nam, nguon }: Props) {
  const [bat, datBat] = useState(banDau)
  const [dangChay, batDau] = useTransition()

  return (
    <button
      disabled={dangChay}
      onClick={() =>
        batDau(async () => {
          const r = await fetch('/api/xem', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ viec: 'danh-dau', khoa, loai, ten, poster, nam, nguon }),
          })
          const j = await r.json()
          if (typeof j.bat === 'boolean') datBat(j.bat)
        })
      }
      className={`flex items-center gap-2 rounded px-4 py-2.5 text-sm font-medium transition disabled:opacity-60 ${
        bat ? 'bg-white/25 text-white' : 'bg-white/10 text-white/80 hover:bg-white/20'
      }`}
    >
      {loai === 'thich' ? (
        <svg viewBox="0 0 24 24" className={`h-4 w-4 ${bat ? 'fill-[var(--color-nhan)]' : 'fill-current'}`}>
          <path d="M12 21s-8-4.9-8-10.4C4 7 6.5 5 9 5c1.8 0 3 1 3 1s1.2-1 3-1c2.5 0 5 2 5 5.6C20 16.1 12 21 12 21z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
          {bat ? <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" /> : <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" />}
        </svg>
      )}
      {bat ? NHAN[loai].bat : NHAN[loai].tat}
    </button>
  )
}
