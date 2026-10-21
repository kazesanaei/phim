'use client'

/**
 * Phía TV của remote điện thoại (C3): mã ghép nằm trong localStorage, có mã là
 * mở luồng SSE và làm theo lệnh. Gắn ở layout nên chuyển trang vẫn nghe tiếp.
 *
 * Mũi tên và Back giả làm phím bấm để đi qua đúng đường của remote thật
 * (PhimRemote.tsx) — một chỗ tính hình học, không viết lại lần hai. OK thì bấm
 * thẳng vào ô đang trỏ vì phím Enter giả không kích hoạt được link/nút.
 *
 * Chiều ngược lại (C2): nghe trạng thái trình phát phát ra và gửi lên trạm cho
 * điện thoại vẽ thanh thời gian, tập kế... Gửi khi đổi trạng thái phát/tập, còn
 * giây đang chạy thì 3 giây một lần — điện thoại tự đếm tiếp ở giữa.
 */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export const KHOA_MA = 'ma-dieu-khien'
export const SU_KIEN_GHEP = 'ghep-dien-thoai'
/** Trình phát (Player.tsx) phát trạng thái lên window bằng sự kiện này. */
export const SU_KIEN_TRANG_THAI = 'trang-thai-phat'

const PHIM: Record<string, string> = {
  len: 'ArrowUp',
  xuong: 'ArrowDown',
  trai: 'ArrowLeft',
  phai: 'ArrowRight',
  lui: 'Escape',
  // Phím tắt của trình phát: C bật/tắt phụ đề
  'phu-de': 'c',
}

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
        if (l.startsWith('tua:')) return v && (v.currentTime = Number(l.slice(4)))
        if (l.startsWith('tap:')) return router.push(l.slice(4))
        const key = PHIM[l]
        if (key) (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
      }
    }

    let truoc = { dang: null as unknown, tap: null as unknown, luc: 0 }
    const baoTrangThai = (e: Event) => {
      let ma: string | null = null
      try {
        ma = localStorage.getItem(KHOA_MA)
      } catch {}
      if (!ma) return
      const tt = (e as CustomEvent<Record<string, unknown> | null>).detail
      const bay = Date.now()
      const doi = !tt || tt.dang !== truoc.dang || tt.tap !== truoc.tap
      if (!doi && bay - truoc.luc < 3000) return
      truoc = { dang: tt?.dang, tap: tt?.tap, luc: bay }
      void fetch('/api/dieu-khien', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ viec: 'trang-thai', ma, tt }),
      }).catch(() => {})
    }

    mo()
    window.addEventListener(SU_KIEN_GHEP, mo)
    window.addEventListener(SU_KIEN_TRANG_THAI, baoTrangThai)
    return () => {
      window.removeEventListener(SU_KIEN_GHEP, mo)
      window.removeEventListener(SU_KIEN_TRANG_THAI, baoTrangThai)
      nguon?.close()
    }
  }, [router])

  return null
}
