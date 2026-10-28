/**
 * Máy chủ có giọng đọc tiếng Việt ("Thuyết Minh #1", "Lồng Tiếng") — người xem không phải đọc phụ đề.
 * Dùng được ở cả máy chủ lẫn trình duyệt (trình phát chọn máy chủ dự phòng theo nó).
 */
export function laThuyetMinh(ten: string): boolean {
  const k = ten.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
  return /thuyet\s*minh|long\s*tieng/.test(k)
}
