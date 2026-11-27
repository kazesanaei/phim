'use client'

import { useEffect, useState } from 'react'
import { KHOA_MA, SU_KIEN_GHEP } from '@/components/NhanDieuKhien'

/** Trang TV: hiện QR để điện thoại quét là thành remote. */
export default function GhepDienThoai() {
  const [du, datDu] = useState<{ ma: string; url: string; svg: string } | null>(null)
  const [loi, datLoi] = useState(false)

  useEffect(() => {
    fetch('/api/dieu-khien', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ viec: 'tao', goc: location.origin }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (!j.ma) throw new Error()
        try {
          localStorage.setItem(KHOA_MA, j.ma)
        } catch {}
        window.dispatchEvent(new Event(SU_KIEN_GHEP))
        datDu(j)
      })
      .catch(() => datLoi(true))
  }, [])

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-10 text-center">
      <h1 className="text-2xl font-bold">Dùng điện thoại làm remote</h1>
      <p className="mt-2 max-w-lg text-sm text-white/60">
        Quét mã bằng camera điện thoại (cùng mạng Wi‑Fi với máy chủ phim). Điện thoại sẽ có nút điều hướng, phát/dừng, tua —
        và gõ tìm phim bằng bàn phím điện thoại.
      </p>
      {loi && <p className="mt-8 text-sm text-red-400">Không tạo được mã ghép. Tải lại trang thử lại.</p>}
      {du && (
        <div className="mt-8 flex flex-col items-center gap-6 md:flex-row">
          <div className="h-56 w-56 rounded-2xl bg-white p-3" dangerouslySetInnerHTML={{ __html: du.svg }} />
          <div className="text-left">
            <p className="text-sm text-white/50">Hoặc mở trên điện thoại</p>
            <p className="mt-1 break-all font-mono text-lg">{du.url.replace(/\?ma=\d+$/, '')}</p>
            <p className="mt-4 text-sm text-white/50">rồi nhập mã</p>
            <p className="chu-hien-thi mt-1 text-6xl font-black tracking-[0.2em] tabular-nums">{du.ma}</p>
          </div>
        </div>
      )}
    </div>
  )
}
