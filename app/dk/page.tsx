'use client'

/**
 * Trang điện thoại của remote (C3). Mở bằng QR trên TV (/ghep-dien-thoai) nên
 * mã có sẵn trong URL; gõ tay thì nhập 4 số. Nút to, đặt theo vị trí ngón cái.
 *
 * Hai chiều (C2): nghe trạng thái TV gửi lên để vẽ "Đang phát" — thanh thời
 * gian kéo được, đổi tập, bật phụ đề. TV chỉ gửi 3 giây một lần nên ở giữa
 * trang tự đếm giây tiếp.
 *
 * Tìm bằng giọng nói (C1): Web Speech của trình duyệt điện thoại, tiếng Việt.
 * Trình duyệt chỉ cho dùng mic trên https — mở bằng http thì đưa link sang cổng
 * https của server.mjs (3443).
 */
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type TapNho = { nhan: string; href: string; dang?: boolean }
type TrangThai = {
  ten: string
  tap: string | null
  t: number
  dai: number
  dang: boolean
  phuDe: boolean
  coPhuDe: boolean
  dsTap: TapNho[]
  tapSau: string | null
  tapTruoc: string | null
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type NhanDang = { lang: string; interimResults: boolean; onresult: ((e: any) => void) | null; onend: (() => void) | null; onerror: ((e: any) => void) | null; start(): void; stop(): void }
const layNhanDang = (): (new () => NhanDang) | null =>
  typeof window === 'undefined' ? null : (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null
/* eslint-enable @typescript-eslint/no-explicit-any */

const CONG_HTTPS = 3443

function mmss(g: number) {
  g = Math.max(0, Math.floor(g))
  const h = Math.floor(g / 3600)
  const m = Math.floor((g % 3600) / 60)
  const s = String(g % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

function Nut({
  nhan,
  lenh,
  gui,
  to,
  tat,
  children,
}: {
  nhan: string
  lenh: string
  gui: (l: string) => void
  to?: boolean
  tat?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      aria-label={nhan}
      disabled={tat}
      onClick={() => {
        navigator.vibrate?.(12)
        gui(lenh)
      }}
      className={`grid place-items-center rounded-2xl bg-white/10 text-white transition active:scale-95 active:bg-white/25 disabled:opacity-30 ${to ? 'h-20 w-20' : 'h-16 w-16'}`}
    >
      {children}
    </button>
  )
}

const HINH = (d: string, nho?: boolean) => (
  <svg viewBox="0 0 24 24" aria-hidden className={`${nho ? 'h-6 w-6' : 'h-8 w-8'} fill-current`}>
    <path d={d} />
  </svg>
)
const P_PHAT = 'M8 5v14l11-7z'
const P_DUNG = 'M6 5h4v14H6zm8 0h4v14h-4z'

function DangPhat({ tt, nhanLuc, gui }: { tt: TrangThai; nhanLuc: number; gui: (l: string) => void }) {
  const [, datNhip] = useState(0)
  const [keo, datKeo] = useState<number | null>(null)
  useEffect(() => {
    if (!tt.dang) return
    const n = setInterval(() => datNhip((x) => x + 1), 1000)
    return () => clearInterval(n)
  }, [tt.dang])
  const t = tt.dang ? Math.min(tt.dai || Infinity, tt.t + (Date.now() - nhanLuc) / 1000) : tt.t
  const hien = keo ?? t
  const tha = () => {
    if (keo === null) return
    gui('tua:' + Math.round(keo))
    datKeo(null)
  }

  return (
    <section className="w-full rounded-2xl bg-mo p-4 ring-1 ring-white/10">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-nhan)]">Đang phát trên TV</p>
      <p className="mt-1 line-clamp-2 font-bold leading-snug">{tt.ten}</p>
      {tt.tap && <p className="text-sm text-white/55">{tt.tap}</p>}

      {tt.dai > 0 && (
        <div className="mt-4">
          <input
            type="range"
            aria-label="Thời gian"
            min={0}
            max={tt.dai}
            step={1}
            value={Math.round(hien)}
            onChange={(e) => datKeo(Number(e.target.value))}
            onPointerUp={tha}
            onKeyUp={tha}
            className="w-full accent-[var(--color-nhan)]"
          />
          <div className="flex justify-between text-xs tabular-nums text-white/50">
            <span>{mmss(hien)}</span>
            <span>-{mmss(tt.dai - hien)}</span>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <Nut nhan="Tập trước" lenh={'tap:' + tt.tapTruoc} gui={gui} tat={!tt.tapTruoc}>
          {HINH('M6 6h2v12H6zm3.5 6 8.5 6V6z', true)}
        </Nut>
        <Nut nhan="Tua lùi 10 giây" lenh="tua-lui" gui={gui}>
          {HINH('M11 18V6l-8.5 6zm.5-6 8.5 6V6z', true)}
        </Nut>
        <Nut nhan={tt.dang ? 'Dừng' : 'Phát'} lenh="phat" gui={gui} to>
          {HINH(tt.dang ? P_DUNG : P_PHAT)}
        </Nut>
        <Nut nhan="Tua tới 10 giây" lenh="tua-toi" gui={gui}>
          {HINH('M4 18l8.5-6L4 6zm9-12v12l8.5-6z', true)}
        </Nut>
        <Nut nhan="Tập sau" lenh={'tap:' + tt.tapSau} gui={gui} tat={!tt.tapSau}>
          {HINH('M6 18l8.5-6L6 6zM16 6h2v12h-2z', true)}
        </Nut>
      </div>

      {tt.coPhuDe && (
        <button
          onClick={() => gui('phu-de')}
          className={`mt-3 w-full rounded-xl py-2.5 text-sm font-semibold ring-1 transition active:scale-[0.98] ${
            tt.phuDe ? 'bg-white text-black ring-white' : 'bg-transparent text-white/80 ring-white/20'
          }`}
        >
          Phụ đề: {tt.phuDe ? 'Bật' : 'Tắt'}
        </button>
      )}

      {tt.dsTap.length > 1 && (
        <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {tt.dsTap.map((x) => (
            <button
              key={x.href}
              onClick={() => !x.dang && gui('tap:' + x.href)}
              aria-current={x.dang ? 'true' : undefined}
              className={`shrink-0 rounded-lg px-3.5 py-2 text-sm font-semibold ${
                x.dang ? 'bg-[var(--color-nhan)] text-white' : 'bg-white/10 text-white/80 active:bg-white/25'
              }`}
            >
              {x.nhan}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function NutMic({ ma, onChu }: { ma: string; onChu: (chu: string) => void }) {
  const [dangNghe, datDangNghe] = useState(false)
  const [loi, datLoi] = useState<string | null>(null)
  const [moi, datMoi] = useState<{ https: boolean; coMay: boolean } | null>(null)
  // Đọc sau khi gắn: lúc dựng phía máy chủ không có window.
  useEffect(() => datMoi({ https: window.isSecureContext, coMay: !!layNhanDang() }), [])
  if (!moi) return null

  if (!moi.https) {
    const u = new URL(location.href)
    u.protocol = 'https:'
    u.port = String(CONG_HTTPS)
    u.searchParams.set('ma', ma)
    return (
      <p className="text-center text-xs leading-relaxed text-white/45">
        Tìm bằng giọng nói cần kết nối https.{' '}
        <a href={u.toString()} className="font-semibold text-white underline underline-offset-2">
          Mở bản https
        </a>{' '}
        (bấm “Nâng cao → Tiếp tục” nếu trình duyệt cảnh báo chứng chỉ), hoặc bấm mic trên bàn phím điện thoại.
      </p>
    )
  }
  if (!moi.coMay) {
    return <p className="text-center text-xs text-white/45">Trình duyệt này không nhận giọng nói — dùng mic trên bàn phím điện thoại.</p>
  }

  function nghe() {
    const May = layNhanDang()
    if (!May) return
    const r = new May()
    r.lang = 'vi-VN'
    r.interimResults = false
    r.onresult = (e) => {
      const chu = String(e.results?.[0]?.[0]?.transcript || '').trim()
      if (chu) onChu(chu)
    }
    r.onerror = (e) => datLoi(e?.error === 'not-allowed' ? 'Chưa cho phép dùng mic.' : 'Không nghe rõ, thử lại.')
    r.onend = () => datDangNghe(false)
    datLoi(null)
    datDangNghe(true)
    navigator.vibrate?.(20)
    r.start()
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={nghe}
        aria-label="Tìm bằng giọng nói"
        className={`flex items-center gap-2 rounded-full px-6 py-3 font-semibold transition active:scale-95 ${
          dangNghe ? 'animate-pulse bg-[var(--color-nhan)] text-white' : 'bg-white/10 text-white'
        }`}
      >
        {HINH('M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1a7 7 0 0 0 6-6.9z', true)}
        {dangNghe ? 'Đang nghe…' : 'Nói tên phim'}
      </button>
      {loi && <p className="text-xs text-amber-300">{loi}</p>}
    </div>
  )
}

function Remote() {
  const sp = useSearchParams()
  const [ma, datMa] = useState(sp.get('ma') || '')
  const [nhap, datNhap] = useState('')
  const [chu, datChu] = useState('')
  const [tin, datTin] = useState<string | null>(null)
  const [tt, datTt] = useState<{ tt: TrangThai; luc: number } | null>(null)

  const hopLe = /^\d{4}$/.test(ma)

  useEffect(() => {
    if (!hopLe) return
    const nguon = new EventSource('/api/dieu-khien?ben=dt&ma=' + ma)
    nguon.onmessage = (e) => {
      const x = JSON.parse(e.data) as TrangThai | null
      datTt(x ? { tt: x, luc: Date.now() } : null)
    }
    nguon.addEventListener('het', () => {
      nguon.close()
      datTin('Mã này hết hạn — mở lại trang “Điện thoại làm remote” trên TV để lấy mã mới.')
    })
    return () => nguon.close()
  }, [ma, hopLe])

  async function gui(lenh: string) {
    try {
      const r = await fetch('/api/dieu-khien', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ viec: 'gui', ma, lenh }),
      })
      const j = await r.json()
      datTin(j.ok ? null : 'TV chưa nghe — mở lại trang “Điện thoại làm remote” trên TV.')
    } catch {
      datTin('Mất kết nối tới máy chủ phim.')
    }
  }

  const tim = (x: string) => {
    const s = x.trim().slice(0, 100)
    if (s) gui('tim:' + s)
  }

  if (!hopLe) {
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
    <div className="mx-auto flex max-w-sm select-none flex-col items-center gap-6 px-4 py-6">
      <form
        className="flex w-full gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          tim(chu)
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
      <NutMic
        ma={ma}
        onChu={(x) => {
          datChu(x)
          tim(x)
        }}
      />

      {tt && <DangPhat tt={tt.tt} nhanLuc={tt.luc} gui={gui} />}

      <div className="grid grid-cols-3 place-items-center gap-3">
        <span />
        <Nut nhan="Lên" lenh="len" gui={gui}>{HINH('M7 14l5-5 5 5z')}</Nut>
        <span />
        <Nut nhan="Trái" lenh="trai" gui={gui}>{HINH('M14 7l-5 5 5 5z')}</Nut>
        <Nut nhan="Chọn" lenh="ok" gui={gui} to>
          <span className="text-lg font-bold">OK</span>
        </Nut>
        <Nut nhan="Phải" lenh="phai" gui={gui}>{HINH('M10 17l5-5-5-5z')}</Nut>
        <span />
        <Nut nhan="Xuống" lenh="xuong" gui={gui}>{HINH('M7 10l5 5 5-5z')}</Nut>
        <span />
      </div>

      <div className="flex gap-3">
        <Nut nhan="Quay lại" lenh="lui" gui={gui}>{HINH('M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z')}</Nut>
        {!tt && (
          <Nut nhan="Phát hoặc dừng" lenh="phat" gui={gui}>
            {HINH('M8 5v14l11-7zM3 5h3v14H3z')}
          </Nut>
        )}
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
