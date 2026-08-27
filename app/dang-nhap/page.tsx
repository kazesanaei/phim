'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

export default function TrangDangNhap() {
  const router = useRouter()
  const [matKhau, datMatKhau] = useState('')
  const [loi, datLoi] = useState<string | null>(null)
  const [dangChay, batDau] = useTransition()

  return (
    <div className="grid min-h-[70vh] place-items-center px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          datLoi(null)
          batDau(async () => {
            const r = await fetch('/api/dang-nhap', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ matKhau }),
            })
            const j = await r.json()
            if (r.ok) {
              router.replace('/')
              router.refresh()
            } else {
              datLoi(j.loi || 'Không đăng nhập được')
            }
          })
        }}
        className="w-full max-w-sm rounded-lg border border-[var(--color-vien)] bg-[var(--color-nen-2)] p-6"
      >
        <h1 className="text-xl font-bold">Kho phim</h1>
        <p className="mt-1 text-sm text-white/45">App đang mở cho mạng nội bộ nên cần mật khẩu.</p>

        <input
          type="password"
          autoFocus
          value={matKhau}
          onChange={(e) => datMatKhau(e.target.value)}
          placeholder="Mật khẩu"
          className="mt-4 w-full rounded border border-[var(--color-vien)] bg-[var(--color-nen)] px-3 py-2.5 outline-none focus:border-white/40"
        />

        {loi && <p className="mt-2 text-sm text-red-400">{loi}</p>}

        <button
          type="submit"
          disabled={dangChay || !matKhau}
          className="mt-4 w-full rounded bg-white py-2.5 text-sm font-semibold text-black disabled:opacity-40"
        >
          {dangChay ? 'Đang kiểm...' : 'Vào xem'}
        </button>

        <p className="mt-4 text-xs leading-relaxed text-white/35">
          Quên mật khẩu? Trên chính máy chạy app, mở terminal trong thư mục dự án và chạy{' '}
          <code className="rounded bg-white/10 px-1">npm run mat-khau</code>.
        </p>
      </form>
    </div>
  )
}
