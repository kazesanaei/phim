'use client'

import { useCallback, useEffect, useState } from 'react'
import Anh from '@/components/Anh'
import Link from 'next/link'

type Hang = {
  id: number
  phim_slug: string
  tap_slug: string
  ten_hien: string
  poster: string | null
  trang_thai: 'cho' | 'dang' | 'xong' | 'loi' | 'huy'
  phan_tram: number
  duong_dan_ra: string | null
  loi: string | null
}

const NHAN_TRANG_THAI: Record<Hang['trang_thai'], string> = {
  cho: 'Đang chờ',
  dang: 'Đang tải',
  xong: 'Xong',
  loi: 'Lỗi',
  huy: 'Đã huỷ',
}

const MAU: Record<Hang['trang_thai'], string> = {
  cho: 'text-white/50',
  dang: 'text-sky-400',
  xong: 'text-emerald-400',
  loi: 'text-red-400',
  huy: 'text-white/35',
}

export default function TrangTaiVe() {
  const [ds, datDs] = useState<Hang[]>([])
  const [coFfmpeg, datCoFfmpeg] = useState(true)
  const [dangTai, datDangTai] = useState(true)

  const nap = useCallback(async () => {
    try {
      const r = await fetch('/api/tai-ve')
      const j = await r.json()
      datDs(j.ds || [])
      datCoFfmpeg(j.coFfmpeg !== false)
    } catch {
      // dev server đang biên dịch lại thì bỏ qua một nhịp
    } finally {
      datDangTai(false)
    }
  }, [])

  useEffect(() => {
    nap()
    // Hỏi lại mỗi giây khi còn việc đang chạy; đứng yên thì giãn ra 5 giây.
    const t = setInterval(nap, 1000)
    return () => clearInterval(t)
  }, [nap])

  async function lam(viec: string, id: number, xoaCaFile = false) {
    await fetch('/api/tai-ve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ viec, id, xoaCaFile }),
    })
    nap()
  }

  const dangChay = ds.filter((h) => h.trang_thai === 'dang' || h.trang_thai === 'cho').length

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">Tải về xem offline</h1>
      <p className="mt-1 text-sm text-white/45">
        Phim tải xong nằm trong thư mục đã đặt ở Quản trị, có phụ đề nhúng sẵn trong file.
        {dangChay > 0 && ` Đang có ${dangChay} mục trong hàng đợi.`}
      </p>

      {!coFfmpeg && (
        <p className="mt-4 rounded border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Không tìm thấy ffmpeg nên chưa tải về được. Đặt đường dẫn ffmpeg trong{' '}
          <Link href="/quan-tri" className="underline underline-offset-2">
            Quản trị
          </Link>
          .
        </p>
      )}

      {dangTai ? (
        <p className="py-16 text-center text-sm text-white/35">Đang nạp...</p>
      ) : ds.length === 0 ? (
        <p className="py-16 text-center text-sm text-white/40">
          Chưa có gì trong hàng đợi. Vào trang một bộ phim rồi bấm{' '}
          <span className="text-white/70">Tải về</span>.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {ds.map((h) => (
            <li
              key={h.id}
              className="flex items-center gap-3 rounded-lg border border-[var(--color-vien)] bg-[var(--color-nen-2)] p-3"
            >
              {h.poster && (
                // eslint-disable-next-line @next/next/no-img-element
                <Anh src={h.poster} rong={200} anAnToan className="h-16 w-11 shrink-0 rounded object-cover" />
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{h.ten_hien}</p>
                <p className={`mt-0.5 text-xs ${MAU[h.trang_thai]}`}>
                  {NHAN_TRANG_THAI[h.trang_thai]}
                  {h.trang_thai === 'dang' && ` · ${h.phan_tram.toFixed(1)}%`}
                  {h.loi && ` · ${h.loi}`}
                </p>

                {(h.trang_thai === 'dang' || h.trang_thai === 'xong') && (
                  <div className="mt-1.5 h-1 overflow-hidden rounded bg-white/10">
                    <div
                      className={`h-full transition-all ${h.trang_thai === 'xong' ? 'bg-emerald-500' : 'bg-sky-500'}`}
                      style={{ width: (h.trang_thai === 'xong' ? 100 : h.phan_tram) + '%' }}
                    />
                  </div>
                )}

                {h.trang_thai === 'xong' && h.duong_dan_ra && (
                  <p className="mt-1 truncate text-[11px] text-white/35" title={h.duong_dan_ra}>
                    {h.duong_dan_ra}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 gap-1.5">
                {(h.trang_thai === 'dang' || h.trang_thai === 'cho') && (
                  <Nut onClick={() => lam('huy', h.id)}>Huỷ</Nut>
                )}
                {(h.trang_thai === 'loi' || h.trang_thai === 'huy') && (
                  <Nut onClick={() => lam('chay-lai', h.id)}>Thử lại</Nut>
                )}
                {h.trang_thai === 'xong' && (
                  <Link
                    href={`/xem/${h.phim_slug}?tap=${h.tap_slug}`}
                    className="rounded bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20"
                  >
                    Xem
                  </Link>
                )}
                <Nut onClick={() => lam('xoa', h.id)}>Xoá</Nut>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Nut({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded bg-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/20 hover:text-white">
      {children}
    </button>
  )
}
