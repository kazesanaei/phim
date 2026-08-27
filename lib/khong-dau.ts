// Dải dấu tổ hợp Unicode U+0300..U+036F, dựng bằng mã ký tự để mã nguồn
// không phải chứa ký tự lạ (và không phụ thuộc vào escape trong chuỗi).
const DAU_TO_HOP = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g')

/** Bỏ dấu tiếng Việt để tìm trong kho local ("nguoi nhen" khớp "Người Nhện"). */
export function khongDau(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(DAU_TO_HOP, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}
