'use client'

/**
 * Thông báo nhỏ ở đáy màn hình, có nút "Hoàn tác".
 *
 * Gọi `thongBao(chu, { hoanTac, khiHet })` từ bất cứ đâu — đi qua sự kiện
 * window nên nút bấm không cần biết khay nằm ở đâu. `khiHet` chạy khi thông báo
 * tự tắt mà người dùng KHÔNG hoàn tác: dùng cho việc xoá hoãn lại (ẩn ngay trên
 * màn, 5 giây sau mới gọi máy chủ), để hoàn tác khỏi phải dựng lại dữ liệu.
 */
import { useEffect, useRef, useState } from 'react'

const SU_KIEN = 'thong-bao'
const SONG_MS = 5000

type Tuy = { hoanTac?: () => void; khiHet?: () => void }
type Muc = Tuy & { id: number; chu: string }

let dem = 0

export function thongBao(chu: string, tuy: Tuy = {}) {
  window.dispatchEvent(new CustomEvent<Muc>(SU_KIEN, { detail: { id: ++dem, chu, ...tuy } }))
}

export default function KhayThongBao() {
  const [ds, datDs] = useState<Muc[]>([])
  const daHoanTac = useRef(new Set<number>())

  useEffect(() => {
    const nhan = (e: Event) => {
      const m = (e as CustomEvent<Muc>).detail
      datDs((c) => [...c.slice(-2), m])
      setTimeout(() => {
        if (!daHoanTac.current.delete(m.id)) m.khiHet?.()
        datDs((c) => c.filter((x) => x.id !== m.id))
      }, SONG_MS)
    }
    window.addEventListener(SU_KIEN, nhan)
    return () => window.removeEventListener(SU_KIEN, nhan)
  }, [])

  return (
    <div aria-live="polite" className="khay-thong-bao pointer-events-none fixed inset-x-0 bottom-6 z-[150] flex flex-col items-center gap-2 px-4">
      {ds.map((m) => (
        <div
          key={m.id}
          className="buong-len pointer-events-auto flex items-center gap-4 rounded-xl bg-noi/95 py-2.5 pl-4 pr-2 text-sm shadow-2xl ring-1 ring-white/10 backdrop-blur"
        >
          <span>{m.chu}</span>
          {m.hoanTac && (
            <button
              onClick={() => {
                daHoanTac.current.add(m.id)
                m.hoanTac?.()
                datDs((c) => c.filter((x) => x.id !== m.id))
              }}
              className="rounded-lg px-3 py-1.5 font-semibold text-[var(--color-nhan)] transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white"
            >
              Hoàn tác
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
