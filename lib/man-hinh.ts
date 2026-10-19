/**
 * Cỡ giao diện theo kích thước màn hình laptop (chế độ PC).
 *
 * VÌ SAO CẦN: cùng một trang, chữ 16px trông rất khác nhau trên từng máy. Laptop
 * 14" độ phân giải 1920×1080 để Windows 100% thì 16px chỉ cao ~2,6 mm — đọc phải
 * ghé sát; cùng tấm màn đó để 150% thì lại vừa. Trình duyệt KHÔNG biết màn hình
 * bao nhiêu inch, nên để chủ máy khai trong Quản trị rồi tự tính.
 *
 * CÁCH TÍNH: biết inch và số CSS px của màn (đã tính cả mức phóng của Windows)
 * thì ra được mật độ CSS px trên mỗi inch. Đem so với MAT_DO_CHUAN — mật độ mà
 * chữ 16px cao khoảng 3,7 mm, vừa mắt ở khoảng cách ngồi laptop (~50 cm) — ra
 * hệ số phóng. Hệ số đặt vào cỡ chữ gốc của <html>: mọi kích thước tính bằng rem
 * (chữ, khoảng cách, nút của Tailwind) giãn theo cùng một tỉ lệ, bố cục giữ nguyên.
 *
 * Lưu ở localStorage CỦA TỪNG TRÌNH DUYỆT, không lưu DB: mỗi máy một tấm màn,
 * TV Box mở cùng app không được ăn theo cỡ của laptop.
 */

export const KHOA_MAN_HINH = 'man-hinh'

export type CaiDatManHinh = {
  /** Đường chéo màn hình, inch. 0 = tắt, giữ cỡ mặc định của trình duyệt. */
  inch: number
  /** Tinh chỉnh thêm theo ý thích, phần trăm (80–130). */
  tinhChinh: number
}

export const MAC_DINH_MAN_HINH: CaiDatManHinh = { inch: 0, tinhChinh: 100 }

/** Các cỡ laptop phổ biến để chọn nhanh. */
export const CO_PHO_BIEN = [13.3, 14, 15.6, 16, 17.3]

/**
 * Đoạn script chạy TRƯỚC khi trang vẽ (nhúng vào <head> như SCRIPT_CHE_DO), và
 * cũng là NƠI DUY NHẤT chứa công thức: nó gắn `window.__manHinh` để trang Quản
 * trị gọi lại khi đổi cài đặt, khỏi phải chép công thức ra hai chỗ.
 *
 *  - MAT_DO_CHUAN = 110 CSS px/inch: chữ 16px cao ~3,7 mm.
 *  - Kẹp hệ số trong 0,9–1,6: dưới 0,9 chữ phụ (10–11px) bắt đầu khó đọc; trên
 *    1,6 thì màn 1366px chỉ còn chỗ cho vài thẻ phim mỗi hàng.
 *  - Màn ≤ 14" thì gắn thêm `data-man-hinh-nho` để CSS thu thấp banner — khung
 *    cao 720px mà banner 60vh thì chỉ còn chỗ cho nửa hàng phim.
 */
export const SCRIPT_MAN_HINH = `(function(){
var K=${JSON.stringify(KHOA_MAN_HINH)};
function tinh(c){
  var w=screen.width,h=screen.height,inch=Number(c&&c.inch)||0;
  if(!inch||!w||!h)return null;
  var matDo=Math.sqrt(w*w+h*h)/inch;
  var tc=Math.min(130,Math.max(80,Number(c.tinhChinh)||100))/100;
  var s=Math.min(1.6,Math.max(0.9,matDo/110))*tc;
  return {heSo:Math.round(s*1000)/1000,matDo:Math.round(matDo),w:w,h:h,dpr:window.devicePixelRatio||1};
}
function apDung(){
  var d=document.documentElement,c=null;
  try{c=JSON.parse(localStorage.getItem(K)||'null')}catch(e){}
  var k=tinh(c);
  if(k){d.style.setProperty('--ti-le-giao-dien',String(k.heSo));d.dataset.manHinh=String(c.inch);
    if(c.inch<=14)d.dataset.manHinhNho='1';else delete d.dataset.manHinhNho;}
  else{d.style.removeProperty('--ti-le-giao-dien');delete d.dataset.manHinh;delete d.dataset.manHinhNho;}
  return k;
}
window.__manHinh={tinh:tinh,apDung:apDung};
try{apDung()}catch(e){}
})()`

export type KetQuaManHinh = { heSo: number; matDo: number; w: number; h: number; dpr: number }

type CuaSoManHinh = Window & {
  __manHinh?: { tinh: (c: CaiDatManHinh) => KetQuaManHinh | null; apDung: () => KetQuaManHinh | null }
}

export function docCaiDatManHinh(): CaiDatManHinh {
  try {
    const c = JSON.parse(localStorage.getItem(KHOA_MAN_HINH) || 'null') as Partial<CaiDatManHinh> | null
    return {
      inch: Math.min(40, Math.max(0, Number(c?.inch) || 0)),
      tinhChinh: Math.min(130, Math.max(80, Number(c?.tinhChinh) || 100)),
    }
  } catch {
    return MAC_DINH_MAN_HINH
  }
}

/** Tính thử (để xem trước trong Quản trị) mà không lưu. */
export function tinhThuManHinh(c: CaiDatManHinh): KetQuaManHinh | null {
  return (window as CuaSoManHinh).__manHinh?.tinh(c) ?? null
}

/** Lưu rồi áp dụng ngay, không cần tải lại trang. */
export function luuManHinh(c: CaiDatManHinh): KetQuaManHinh | null {
  try {
    localStorage.setItem(KHOA_MAN_HINH, JSON.stringify(c))
  } catch {
    // chế độ riêng tư: vẫn áp dụng cho lần mở này
  }
  return (window as CuaSoManHinh).__manHinh?.apDung() ?? null
}
