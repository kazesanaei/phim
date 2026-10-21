'use client'

/**
 * Trang điện thoại của remote (C3). Mở bằng QR trên TV (/ghep-dien-thoai) nên
 * mã có sẵn trong URL; gõ tay thì nhập 4 số. Nút to, đặt theo vị trí ngón cái.
 */
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'

function Nut({ nhan, lenh, gui, to, children }: { nhan: string; lenh: string; gui: (l: string) => void; to?: boolean; children: React.ReactNode }) {
  return (
    <button
      aria-label={nhan}
      onClick={() => {
        navigator.vibrate?.(12)
        gui(lenh)
      }}
      className={`grid place-items-center rounded-2xl bg-white/10 text-white transition active:scale-95 active:bg-white/25 ${to ? 'h-20 w-20' : 'h-16 w-16'}`}
    >
      {children}
    </button>
  )
}

const MUI = (d: string) => (
  <svg viewBox="0 0 24 24" aria-hidden className="h-8 w-8 fill-current">
    <path d={d} />
  </svg>
)

function Remote() {
  const sp = useSearchParams()
  const [ma, datMa] = useState(sp.get('ma') || '')
  const [nhap, datNhap] = useState('')
  const [chu, datChu] = useState('')
  const [tin, datTin] = useState<string | null>(null)

  async function gui(lenh: string) {
    try {
      const r = await fetch('/api/dieu-khien', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ viec: 'gui', ma, lenh }),
      })
      const j = await r.json()
      datTin(j.ok ? null : 'TV chưa nghe — mở lại trang “Dùng điện thoại làm remote” trên TV.')
    } catch {
      datTin('Mất kết nối tới máy chủ phim.')
    }
  }

  if (!/^\d{4}$/.test(ma)) {
    return (
      <form
        className="mx-auto flex max-w-xs flex-col items-center gap-4 px-4 py-16 text-center"
        onSubmit={(e) => {
          e.preventDefault()
          datMa(nhap)
        }}
      >
        <h1 className="text-xl font-bold">Nhập mã trên TV</h1>
        <input
          inputMode="numeric"
          maxLength={4}
          value={nhap}
          onChange={(e) => datNhap(e.target.value.replace(/\D/g, ''))}
          className="w-40 rounded-xl bg-white/10 py-3 text-center text-3xl font-bold tracking-[0.3em] outline-none ring-1 ring-white/15 focus:ring-white/40"
          autoFocus
        />
        <button className="rounded-lg bg-white px-6 py-2.5 font-semibold text-black">Ghép</button>
      </form>
    )
  }

  return (
    <div className="mx-auto flex max-w-sm select-none flex-col items-center gap-8 px-4 py-8">
      <form
        className="flex w-full gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (chu.trim()) gui('tim:' + chu.trim().slice(0, 100))
          datChu('')
        }}
      >
        <input
          value={chu}
          onChange={(e) => datChu(e.target.value)}
          placeholder="Gõ tên phim để tìm trên TV"
          className="min-w-0 flex-1 rounded-xl bg-white/10 px-4 py-3 outline-none ring-1 ring-white/15 focus:ring-white/40"
        />
        <button className="rounded-xl bg-white px-4 font-semibold text-black">Tìm</button>
      </form>

      <div className="grid grid-cols-3 place-items-center gap-3">
        <span />
        <Nut nhan="Lên" lenh="len" gui={gui}>{MUI('M7 14l5-5 5 5z')}</Nut>
        <span />
        <Nut nhan="Trái" lenh="trai" gui={gui}>{MUI('M14 7l-5 5 5 5z')}</Nut>
        <Nut nhan="Chọn" lenh="ok" gui={gui} to>
          <span className="text-lg font-bold">OK</span>
        </Nut>
        <Nut nhan="Phải" lenh="phai" gui={gui}>{MUI('M10 17l5-5-5-5z')}</Nut>
        <span />
        <Nut nhan="Xuống" lenh="xuong" gui={gui}>{MUI('M7 10l5 5 5-5z')}</Nut>
        <span />
      </div>

      <div className="flex gap-3">
        <Nut nhan="Quay lại" lenh="lui" gui={gui}>{MUI('M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z')}</Nut>
        <Nut nhan="Tua lùi 10 giây" lenh="tua-lui" gui={gui}>{MUI('M11 18V6l-8.5 6zm.5-6 8.5 6V6z')}</Nut>
        <Nut nhan="Phát hoặc dừng" lenh="phat" gui={gui}>{MUI('M8 5v14l11-7zM3 5h3v14H3z')}</Nut>
        <Nut nhan="Tua tới 10 giây" lenh="tua-toi" gui={gui}>{MUI('M4 18l8.5-6L4 6zm9-12v12l8.5-6z')}</Nut>
      </div>

      {tin && <p className="text-center text-sm text-amber-300">{tin}</p>}
      <p className="text-xs text-white/35">Đang ghép với TV mã {ma}</p>
    </div>
  )
}

export default function TrangDieuKhien() {
  return (
    <Suspense>
      <Remote />
    </Suspense>
  )
}
