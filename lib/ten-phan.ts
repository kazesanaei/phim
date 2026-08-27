/**
 * Tách "- Phần N" khỏi tên phim. Cố ý KHÔNG phụ thuộc gì để bộ kiểm nạp thẳng
 * được bằng Node (xem bẫy #12 trong README).
 *
 * Tách theo TÊN TIẾNG VIỆT chứ không theo origin_name: tên Việt luôn sạch
 * ("- Phần 4"), còn tên gốc lắm khi lằng nhằng ("4th Season: Second Year,
 * First Semester").
 */

// Dấu ngăn có thể là -, –, — hoặc :
const MAU = [
  /[\s]*[-–—:][\s]*(?:phần|phan)[\s]*(\d{1,3})[\s]*$/i,
  /[\s]*[-–—:][\s]*(?:season|part)[\s]*(\d{1,3})[\s]*$/i,
  /[\s]*\((?:phần|phan|season|part)[\s]*(\d{1,3})\)[\s]*$/i,
]

export type TenPhan = { goc: string; phan: number | null }

/** "Gia Đình Heck - Phần 9" -> { goc: "Gia Đình Heck", phan: 9 } */
export function tachPhan(ten: string): TenPhan {
  const s = (ten || '').trim()
  for (const m of MAU) {
    const k = s.match(m)
    // index > 0: đừng nuốt cả tên khi tên CHÍNH LÀ "Phần 2" hay "Season 1"
    if (k && k.index !== undefined && k.index > 0) {
      return { goc: s.slice(0, k.index).trim(), phan: Number(k[1]) }
    }
  }
  return { goc: s, phan: null }
}
