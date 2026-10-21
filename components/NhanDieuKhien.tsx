'use client'

/**
 * Phía TV của remote điện thoại (C3): mã ghép nằm trong localStorage, có mã là
 * mở luồng SSE và làm theo lệnh. Gắn ở layout nên chuyển trang vẫn nghe tiếp.
 *
 * Mũi tên và Back giả làm phím bấm để đi qua đúng đường của remote thật
 * (PhimRemote.tsx) — một chỗ tính hình học, không viết lại lần hai. OK thì bấm
 * thẳng vào ô đang trỏ vì phím Enter giả không kích hoạt được link/nút.
 */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export const KHOA_MA = 'ma-dieu-khien'
export const SU_KIEN_GHEP = 'ghep-dien-thoai'

const PHIM: Record<string, string> = { len: 'ArrowUp', xuong: 'ArrowDown', trai: 'ArrowLeft', phai: 'ArrowRight', lui: 'Escape' }

export default function NhanDieuKhien() {
  const router = useRouter()

  useEffect(() => {
    let nguon: EventSource | null = null

    const mo = () => {
      nguon?.close()
      let ma: string | null = null
      try {
        ma = localStorage.getItem(KHOA_MA)
      } catch {}
      if (!ma) return
      nguon = new EventSource('/api/dieu-khien?ma=' + ma)
      // Máy chủ khởi động lại thì mã cũ mất — xoá để trang ghép tạo mã mới.
      nguon.addEventListener('het', () => {
        nguon?.close()
        try {
          localStorage.removeItem(KHOA_MA)
        } catch {}
      })
      nguon.onmessage = (e) => {
        const l = JSON.parse(e.data) as string
        const v = document.getElementById('video-chinh') as HTMLVideoElement | null
        if (l.startsWith('tim:')) return router.push('/tim-kiem?q=' + encodeURIComponent(l.slice(4)))
        if (l === 'ok') return (document.activeElement as HTMLElement | null)?.click()
        if (l === 'phat') return v && (v.paused ? void v.play() : v.pause())
        if (l === 'tua-lui' || l === 'tua-toi') return v && (v.currentTime += l === 'tua-toi' ? 10 : -10)
        const key = PHIM[l]
        if (key) (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
      }
    }

    mo()
    window.addEventListener(SU_KIEN_GHEP, mo)
    return () => {
      window.removeEventListener(SU_KIEN_GHEP, mo)
      nguon?.close()
    }
  }, [router])

  return null
}
