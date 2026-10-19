/**
 * Phát hiện máy chủ phát CHẬM (giật, chờ tải mãi) để tự đổi máy chủ.
 *
 * Cố ý KHÔNG phụ thuộc gì: trình phát (trình duyệt) và bộ kiểm (Node thuần, xem
 * bẫy #12 trong README) đều nạp thẳng được.
 *
 * Hai kiểu chậm, bắt cả hai:
 *  - Chờ LIỀN một lèo quá lâu (máy chủ gần như đứng).
 *  - Giật LẮT NHẮT: nhiều lần chờ ngắn trong vài phút, cộng lại thì quá nhiều.
 *
 * Chờ ngay SAU KHI TUA hay lúc MỚI MỞ thì nới ngưỡng ra: tua tới chỗ chưa tải
 * thì phải chờ là bình thường, kể cả máy chủ khoẻ. Những lần chờ đó cũng không
 * tính vào tổng giật lắt nhắt — không thì người hay tua bị đá sang máy chủ khác
 * oan.
 */

/** Chờ liền chừng này giây (trong lúc đang xem) là coi như máy chủ đứng. */
export const NGUONG_MOT_LAN_GIAY = 12
/** Ngưỡng nới cho lần chờ ngay sau khi tua hoặc lúc mới mở. */
export const NGUONG_SAU_TUA_GIAY = 20
/** Cửa sổ xét giật lắt nhắt. */
export const CUA_SO_GIAY = 120
/** Trong cửa sổ đó: ít nhất chừng này lần chờ... */
export const NGUONG_SO_LAN = 3
/** ...cộng lại ít nhất chừng này giây thì coi là chậm. */
export const NGUONG_TONG_GIAY = 20

export type LanCho = { tu: number; den: number; sauTua: boolean }
export type DangCho = { tu: number; sauTua: boolean } | null

/**
 * Máy chủ có đang chậm không, tại thời điểm `bayGio` (ms). Trả câu giải thích
 * (để hiện cho người xem biết vì sao đổi) hoặc null.
 */
export function laCham(lichSu: LanCho[], dangCho: DangCho, bayGio: number): string | null {
  if (dangCho) {
    const giay = (bayGio - dangCho.tu) / 1000
    if (giay >= (dangCho.sauTua ? NGUONG_SAU_TUA_GIAY : NGUONG_MOT_LAN_GIAY)) {
      return `chờ tải ${Math.round(giay)} giây chưa xong`
    }
  }
  const tu = bayGio - CUA_SO_GIAY * 1000
  const lan = lichSu.filter((l) => !l.sauTua && l.den > tu).map((l) => (l.den - Math.max(l.tu, tu)) / 1000)
  if (dangCho && !dangCho.sauTua) lan.push((bayGio - Math.max(dangCho.tu, tu)) / 1000)
  const tong = lan.reduce((a, b) => a + b, 0)
  if (lan.length >= NGUONG_SO_LAN && tong >= NGUONG_TONG_GIAY) {
    return `giật ${lan.length} lần trong ${Math.round(CUA_SO_GIAY / 60)} phút, chờ tổng ${Math.round(tong)} giây`
  }
  return null
}

/** Giữ lịch sử gọn: bỏ những lần chờ đã ra khỏi cửa sổ xét. */
export function donLichSu(lichSu: LanCho[], bayGio: number): LanCho[] {
  return lichSu.filter((l) => l.den > bayGio - CUA_SO_GIAY * 1000)
}
