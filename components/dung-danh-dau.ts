'use client'

/**
 * Trạng thái "đã lưu vào danh sách" dùng chung cho mọi thẻ phim trên trang.
 *
 * VÌ SAO PHẢI GOM: nút lưu nằm trên TỪNG thẻ, mà một trang chủ có cả trăm thẻ.
 * Nếu mỗi thẻ tự hỏi máy chủ thì thành cả trăm lượt gọi cho một việc đã có sẵn
 * trong một câu trả lời. Ở đây gọi ĐÚNG MỘT LẦN cho cả trang (lời hứa để ở cấp
 * module nên mọi thẻ dùng chung), rồi phát thay đổi cho các thẻ khác.
 *
 * Không đẩy trạng thái này xuống từ máy chủ vì thẻ phim được dựng ở cả chục nơi
 * khác nhau — thêm một prop là phải sửa hết ngần ấy chỗ.
 */
import { useEffect, useState } from 'react'

const SU_KIEN = 'doi-danh-dau'

let hua: Promise<Set<string>> | null = null
let kho: Set<string> | null = null

function nap(): Promise<Set<string>> {
  if (hua) return hua
  hua = fetch('/api/xem')
    .then((r) => (r.ok ? r.json() : { xemSau: [] }))
    .then((j) => {
      kho = new Set(((j.xemSau ?? []) as { khoa: string }[]).map((x) => x.khoa))
      return kho
    })
    .catch(() => {
      // Chưa đăng nhập hoặc mất mạng: coi như chưa lưu gì, nút vẫn bấm được.
      kho = new Set()
      return kho
    })
  return hua
}

/** Báo cho mọi thẻ đang mở biết một phim vừa được lưu hoặc bỏ lưu. */
export function datDanhDau(khoa: string, bat: boolean) {
  if (!kho) kho = new Set()
  if (bat) kho.add(khoa)
  else kho.delete(khoa)
  window.dispatchEvent(new CustomEvent(SU_KIEN, { detail: { khoa, bat } }))
}

/** `null` = chưa biết (chưa nạp xong) — để nút không nhấp nháy sai trạng thái. */
export function dungDanhDau(khoa: string): boolean | null {
  const [bat, datBat] = useState<boolean | null>(() => (kho ? kho.has(khoa) : null))

  useEffect(() => {
    let con = true
    void nap().then((k) => con && datBat(k.has(khoa)))

    const f = (e: Event) => {
      const d = (e as CustomEvent<{ khoa: string; bat: boolean }>).detail
      if (d.khoa === khoa) datBat(d.bat)
    }
    window.addEventListener(SU_KIEN, f)
    return () => {
      con = false
      window.removeEventListener(SU_KIEN, f)
    }
  }, [khoa])

  return bat
}
