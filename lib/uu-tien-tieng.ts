import { headers } from 'next/headers'
import { layCaiDat } from '@/lib/db'

/**
 * Có đưa máy chủ thuyết minh/lồng tiếng lên trước không: trang xem chọn nó khi không chỉ rõ máy chủ,
 * trang phim xếp danh sách tập của nó lên đầu.
 * Cài đặt `uu_tien_thuyet_minh`: 'bat' | 'tat' | '' (mặc định: bật cho app Kho phim trên TV box —
 * người xem ở đó là bố mẹ, khó đọc phụ đề; tắt trên laptop). Đổi trên box: xem tv-box/HUONG-DAN.md.
 */
export async function uuTienThuyetMinh(): Promise<boolean> {
  const c = layCaiDat('uu_tien_thuyet_minh')
  if (c === 'bat') return true
  if (c === 'tat') return false
  return (await headers()).get('user-agent')?.includes('KhoPhimTV') ?? false
}
