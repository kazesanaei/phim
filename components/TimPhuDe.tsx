'use client'

/** Tìm và tải phụ đề từ OpenSubtitles cho phim trong máy. */
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Muc = { id: string; ten: string; ngonNgu: string; luotTai: number }

export default function TimPhuDe({ tapId, tuKhoa, nam }: { tapId: number; tuKhoa: string; nam?: number }) {
  const router = useRouter()
  const [mo, datMo] = useState(false)
  const [tu, datTu] = useState(tuKhoa)
  const [ds, datDs] = useState<Muc[] | null>(null)
  const [tin, datTin] = useState<string | null>(null)
  const [dangChay, datDangChay] = useState(false)

  async function tim() {
    datDangChay(true)
    datTin(null)
    try {
      const u = new URL('/api/phu-de-ngoai', location.origin)
      u.searchParams.set('q', tu)
      if (nam) u.searchParams.set('nam', String(nam))
      const r = await fetch(u)
      const j = await r.json()
      if (!r.ok) datTin(j.loi || 'Không tìm được')
      else {
        datDs(j.ds || [])
        if (!j.ds?.length) datTin('Không thấy phụ đề nào khớp.')
      }
    } finally {
      datDangChay(false)
    }
  }

  async function tai(m: Muc) {
    datDangChay(true)
    datTin(null)
    try {
      const r = await fetch('/api/phu-de-ngoai', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tapId, fileId: m.id, nhan: m.ten, ngonNgu: m.ngonNgu }),
      })
      const j = await r.json()
      if (!r.ok) datTin(j.loi || 'Không tải được')
      else {
        datTin('Đã tải xong. Tải lại trang để phụ đề xuất hiện trong player.')
        router.refresh()
      }
    } finally {
      datDangChay(false)
    }
  }

  if (!mo) {
    return (
      <button
        onClick={() => datMo(true)}
        className="rounded border border-[var(--color-vien)] px-3 py-1.5 text-sm text-white/70 hover:text-white"
      >
        Tìm phụ đề trên mạng
      </button>
    )
  }

  return (
    <div className="w-full rounded-lg border border-[var(--color-vien)] bg-[var(--color-nen-2)] p-3">
      <div className="flex flex-wrap gap-2">
        <input
          value={tu}
          onChange={(e) => datTu(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && tim()}
          placeholder="Tên phim (tiếng Anh cho ra nhiều kết quả hơn)"
          className="min-w-56 flex-1 rounded border border-[var(--color-vien)] bg-[var(--color-nen)] px-3 py-2 text-sm outline-none focus:border-white/40"
        />
        <button
          onClick={tim}
          disabled={dangChay || !tu.trim()}
          className="rounded bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
        >
          {dangChay ? 'Đang chạy...' : 'Tìm'}
        </button>
        <button onClick={() => datMo(false)} className="rounded bg-white/10 px-3 py-2 text-sm hover:bg-white/20">
          Đóng
        </button>
      </div>

      {tin && <p className="mt-2 text-sm text-white/60">{tin}</p>}

      {ds && ds.length > 0 && (
        <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto">
          {ds.map((m) => (
            <li key={m.id}>
              <button
                onClick={() => tai(m)}
                disabled={dangChay}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-white/10 disabled:opacity-40"
              >
                <span className="min-w-0 flex-1 truncate">{m.ten}</span>
                <span className="shrink-0 text-xs text-white/35">
                  {m.ngonNgu} · {m.luotTai.toLocaleString('vi-VN')} lượt
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
