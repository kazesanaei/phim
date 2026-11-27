'use client'

/**
 * Vạch đỏ chạy trên đỉnh trang khi đang chuyển trang.
 *
 * Hai pha: `ChoLink` (đặt TRONG một <Link>) bật vạch từ lúc bấm tới lúc lịch sử
 * đổi — quãng trống khi link chưa prefetch xong. Sau đó loading.tsx của tuyến
 * đích vẽ `ThanhTai` cho tới khi trang thật về. Cả hai dùng chung một vạch CSS.
 */
import { useLinkStatus } from 'next/link'
import { useEffect } from 'react'

export function ChoLink() {
  const { pending } = useLinkStatus()
  useEffect(() => {
    if (!pending) return
    const h = document.documentElement
    h.dataset.dangTai = ''
    return () => void delete h.dataset.dangTai
  }, [pending])
  return null
}

export default function ThanhTai() {
  return <div aria-hidden className="thanh-tai" />
}
