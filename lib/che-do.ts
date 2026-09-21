/**
 * Chế độ hiển thị: 'pc' hoặc 'tv'.
 *
 * VÌ SAO KHÔNG ĐỌC COOKIE TRONG layout.tsx: `cookies()` ép TOÀN BỘ trang sang
 * dựng lúc chạy, mất hết phần tĩnh (cùng lý do đã viết ở app/api/dau-trang).
 * Thay vào đó một đoạn script chạy trước khi trang vẽ, đặt `data-che-do` lên
 * thẻ <html>. CSS bắt theo thuộc tính đó nên không hề chớp giao diện.
 *
 * Vẫn ghi cookie song song với localStorage: cookie để sau này máy chủ đọc được
 * nếu cần, localStorage để đọc đồng bộ ngay lúc script chạy (cookie cũng đọc
 * đồng bộ được, nhưng localStorage không bị gửi kèm mọi yêu cầu ảnh).
 */
export type CheDo = 'pc' | 'tv'

export const KHOA_CHE_DO = 'che-do'

/**
 * Đoạn script nhúng thẳng vào <head>. Phải là chuỗi vì cần chạy TRƯỚC React.
 * Giữ thật ngắn và tự bọc trong try/catch: chế độ riêng tư của trình duyệt làm
 * localStorage ném lỗi, mà script này hỏng là cả trang trắng.
 */
export const SCRIPT_CHE_DO = `(function(){try{
var d=document.documentElement,k=${JSON.stringify(KHOA_CHE_DO)},v=null;
try{v=localStorage.getItem(k)}catch(e){}
if(!v){var m=document.cookie.match(/(?:^|; )che-do=(tv|pc)/);if(m)v=m[1]}
d.dataset.cheDo=v==='tv'?'tv':'pc';
}catch(e){document.documentElement.dataset.cheDo='pc'}})()`

/** Đọc chế độ hiện tại ở phía trình duyệt. */
export function docCheDo(): CheDo {
  if (typeof document === 'undefined') return 'pc'
  return document.documentElement.dataset.cheDo === 'tv' ? 'tv' : 'pc'
}

/**
 * Đổi chế độ. Ghi cả hai chỗ rồi đặt lại thuộc tính — CSS đổi ngay, không tải lại trang.
 * Bắn sự kiện để các thành phần đang mở biết mà vẽ lại phần khác nhau về cấu trúc.
 */
export function datCheDo(cd: CheDo) {
  try {
    localStorage.setItem(KHOA_CHE_DO, cd)
  } catch {
    // chế độ riêng tư — cookie phía dưới vẫn giữ được lựa chọn
  }
  // 1 năm, chỉ gửi trong cùng trang. Không cần Secure vì chạy trên http nội bộ.
  document.cookie = `${KHOA_CHE_DO}=${cd}; path=/; max-age=31536000; samesite=lax`
  document.documentElement.dataset.cheDo = cd
  window.dispatchEvent(new CustomEvent('doi-che-do', { detail: cd }))
}
