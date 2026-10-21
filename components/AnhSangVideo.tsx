'use client'

/**
 * Ánh sáng tràn quanh khung phim (D3) — kiểu "chế độ môi trường" của YouTube.
 * Vẽ khung hình đang chiếu vào một canvas tí hon (32x18) mỗi nửa giây, rồi CSS
 * làm nhoè và phóng to ra sau lưng trình phát. Rẻ: không đọc điểm ảnh nào
 * (canvas bị "nhiễm" CORS cũng chẳng sao), không chạy khi tạm dừng hay ẩn tab.
 * Chỉ PC: TV Box yếu, và trên TV phim chiếm cả màn hình nên chẳng thấy viền.
 */
import { useEffect, useRef } from 'react'
import { dungCheDo } from '@/components/dung-che-do'

export default function AnhSangVideo() {
  const cRef = useRef<HTMLCanvasElement>(null)
  const laTv = dungCheDo() === 'tv'

  useEffect(() => {
    if (laTv) return
    const c = cRef.current
    const ve = c?.getContext('2d')
    if (!c || !ve) return
    const nhip = setInterval(() => {
      const v = document.getElementById('video-chinh') as HTMLVideoElement | null
      if (!v || v.paused || document.hidden || v.readyState < 2) return
      try {
        ve.drawImage(v, 0, 0, c.width, c.height)
        c.dataset.co = '1'
      } catch {
        // Khung chưa sẵn — lượt sau vẽ.
      }
    }, 500)
    return () => clearInterval(nhip)
  }, [laTv])

  if (laTv) return null
  return <canvas ref={cRef} width={32} height={18} aria-hidden className="anh-sang-video" />
}
