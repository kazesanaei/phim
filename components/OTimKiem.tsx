'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export default function OTimKiem() {
  const router = useRouter()
  const sp = useSearchParams()
  const [q, datQ] = useState(sp.get('q') || '')
  const oRef = useRef<HTMLInputElement>(null)

  // Phím "/" nhảy vào ô tìm, quen tay như trên các trang tài liệu.
  useEffect(() => {
    function f(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === '/') {
        e.preventDefault()
        oRef.current?.focus()
      }
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [])

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (q.trim()) router.push('/tim-kiem?q=' + encodeURIComponent(q.trim()))
      }}
    >
      <input
        ref={oRef}
        value={q}
        onChange={(e) => datQ(e.target.value)}
        placeholder="Tìm phim...   /"
        aria-label="Tìm phim"
        className="w-36 rounded border border-[var(--color-vien)] bg-[var(--color-nen-2)] px-3 py-1.5 text-sm outline-none transition-all placeholder:text-white/30 focus:w-60 focus:border-white/40 sm:w-48"
      />
    </form>
  )
}
