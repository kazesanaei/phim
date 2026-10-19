/**
 * Lưới tên 18+ — HAI MỨC. Cố ý KHÔNG phụ thuộc gì để bộ kiểm nạp thẳng được
 * bằng Node (xem bẫy #12 trong README).
 *
 * VÌ SAO HAI MỨC: chủ dự án định nghĩa "phim 18+" là phim TOÀN BỘ thiên về
 * tình dục — thứ đó phải chặn hẳn. Còn phim có cảnh nóng, phim kinh dị, phim tài
 * liệu về ngành phim người lớn thì vẫn là phim đàng hoàng, chỉ cần GẮN MÁC và
 * hỏi lại trước khi xem.
 *
 * Đo trên kho 18.719 phim (18/10/2026) với lưới cũ một mức:
 *  - 0 phim kinh dị bị bắt — lưới tên không phải chỗ chặn nhầm phim kinh dị;
 *    chỗ đó là sổ đen theo thể loại, xem phanLoaiSoDen() ở lib/loc-18.ts.
 *  - Nhưng có bắt nhầm phim tài liệu (After Porn Ends, X-Rated: The Greatest
 *    Adult Movies), phim nghệ thuật (Babardeala cu bucluc sau porno balamuc —
 *    Gấu Vàng Berlin 2021), hài Anh (Scenes of a Sexual Nature)... Những từ đó
 *    giờ chỉ GẮN MÁC.
 *  - Và để lọt 7 phim JAV thật, tên gốc mở đầu bằng mã kiểu "SONE-852" — xem
 *    laMaJav() bên dưới.
 */

// Cùng cách bỏ dấu với lib/khong-dau.ts — chép lại vì lý do ở đầu tệp.
const DAU_TO_HOP = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g')
function khongDau(s: string): string {
  return (s || '').normalize('NFD').replace(DAU_TO_HOP, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim()
}

export type Muc18 = 'chan' | 'canh-bao'

/**
 * CHẶN HẲN: chỉ những cụm mà phim đàng hoàng gần như không bao giờ mang.
 * Khớp TỪ TRỌN VẸN chứ không phải chuỗi con ("sex" không bắt "Sexsomnia").
 */
const TU_CHAN = [
  'phim sex',
  'sao phim nguoi lon',
  'pornstar',
  'jav',
  'javhd',
  'av idol',
  'hentai',
  'nguoi lon 18',
  'phim 18',
  'r18',
  'khong che',
  'uncensored',
  'thac loan',
  'loan luan',
  'xuat tinh',
]

/**
 * GẮN MÁC 18+: dấu hiệu nội dung người lớn nhưng phim đàng hoàng cũng có thể
 * mang. Mỗi từ có ví dụ phim thật trong kho để biết vì sao không chặn hẳn.
 */
const TU_CANH_BAO = [
  'khieu dam', // Báo Thù Khiêu Dâm (thriller Nhật), Sextortion Killers (tài liệu)
  'phim nguoi lon', // X-Rated: The Greatest Adult Movies (tài liệu)
  'porn', // After Porn Ends (tài liệu)
  'porno', // Babardeala cu bucluc sau porno balamuc (Gấu Vàng Berlin)
  'erotic',
  'erotica',
  'softcore',
  'ecchi', // anime có cảnh hở hang, không phải phim người lớn
  '18+',
  '19+',
  'nhuc duc',
  'dam duc',
  'gai goi', // Jeune & Jolie (François Ozon)
  'sexual nature', // Scenes of a Sexual Nature (hài Anh)
  'kamasutra', // Kama Sutra: A Tale of Love (Mira Nair)
]

/**
 * Từ khoá tiếng Nhật chỉ xuất hiện trong tên phim AV. Khớp chuỗi con vì tiếng
 * Nhật không có khoảng trắng giữa các từ.
 */
const TU_NHAT = ['中出し', '性交', '射精', '乱交', 'ぶっかけ', '痴漢', 'av女優']

/** Có chữ kana (Hiragana/Katakana) — dấu hiệu tên tiếng Nhật. */
const KANA = /[぀-ヿ]/
/** Mã phim AV ở ĐẦU tên gốc: "SONE-852", "FSDSS-907", "IPZZ-703". */
const MA_DAU = /^[A-Z]{2,6}-\d{3,5}/

/** Tên gốc CHỈ là một mã AV — mã AV gần như luôn đúng 3 chữ số. */
const CHI_MA = /^[A-Z]{2,6}-\d{3}$/

/**
 * Tên gốc mở đầu bằng mã AV. Chỉ nhận khi kèm chữ kana, HOẶC tên gốc chỉ là cái
 * mã ba chữ số — để "THX-1138" (phim đầu tay của George Lucas, bốn chữ số)
 * không bị bắt oan. Cả 7 phim AV trong kho đều khớp một trong hai điều kiện.
 */
export function laMaJav(tenGoc: string): boolean {
  const s = (tenGoc || '').trim()
  if (!MA_DAU.test(s)) return false
  return KANA.test(s) || CHI_MA.test(s)
}

/**
 * Ranh giới từ tự dựng thay vì `\b`: từ khoá có `+` (như "18+") thì `\b` đặt
 * sai chỗ và không khớp gì cả.
 */
function khopTuTronVen(chuoi: string, tu: string): boolean {
  const thoat = tu.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp('(^|[^a-z0-9])' + thoat + '($|[^a-z0-9])', 'i').test(chuoi)
}

export type KetQuaTen = { muc: Muc18; lyDo: string } | null

/** Xét tên tiếng Việt lẫn tên gốc. Trả mức nặng nhất và lý do để hiện trong Quản trị. */
export function xetTen18(ten: string, tenGoc?: string): KetQuaTen {
  const a = khongDau(ten)
  const b = khongDau(tenGoc || '')
  const goc = tenGoc || ''

  if (laMaJav(goc)) return { muc: 'chan', lyDo: 'Tên gốc là mã phim AV' }
  const nhat = TU_NHAT.find((t) => goc.includes(t))
  if (nhat) return { muc: 'chan', lyDo: `Tên gốc chứa "${nhat}"` }
  const chan = TU_CHAN.find((t) => khopTuTronVen(a, t) || khopTuTronVen(b, t))
  if (chan) return { muc: 'chan', lyDo: `Tên chứa "${chan}"` }
  const canh = TU_CANH_BAO.find((t) => khopTuTronVen(a, t) || khopTuTronVen(b, t))
  if (canh) return { muc: 'canh-bao', lyDo: `Tên chứa "${canh}"` }
  return null
}

/**
 * Thể loại cho biết phim là phim "đàng hoàng" có yếu tố người lớn, không phải
 * phim tình dục. Phim nằm trong thể loại 18+ của nguồn mà CÒN thuộc một trong
 * các thể loại này thì chỉ gắn mác, không chặn.
 *
 * Cố ý KHÔNG có: tình cảm, tâm lý, chính kịch, cổ trang, hài — phim tình dục hay
 * được gắn đúng mấy nhãn đó (Nhục Bồ Đoàn là cổ trang, phim sex Hồng Kông là hài).
 */
export const THE_LOAI_DANG_HOANG = new Set([
  'kinh-di',
  'hinh-su',
  'toi-pham',
  'hanh-dong',
  'giat-gan',
  'bi-an',
  'chien-tranh',
  'vien-tuong',
  'khoa-hoc-vien-tuong',
  'khoa-hoc',
  'phieu-luu',
  'tai-lieu',
  'chu-de-thuc-te',
  'lich-su',
  'the-thao',
])

/**
 * Phim TMDB có từ chừng này phiếu trở lên là phim chiếu rạp phổ biến (Sắc, Giới;
 * Mặt Nạ Kiều Nữ...), không phải phim tình dục làm ra để xem tình dục: phim AV
 * gần như không có trên TMDB, phim 18+ Hàn làm hàng loạt chỉ vài chục phiếu.
 */
export const PHIEU_PHO_BIEN = 300

/**
 * Phim nằm trong thể loại 18+ của nguồn: chặn hay chỉ gắn mác.
 *
 * CHỈ CHẶN phim mà nội dung chính xoay quanh tình dục. Thể loại 18+ của nguồn
 * gom cả phim đàng hoàng có cảnh nóng, nên xét thêm theo thứ tự:
 *  1. Tên dính lưới chặn (mã AV, "phim sex"...) thì chặn, thể loại gì cũng vậy.
 *  2. Còn thuộc thể loại đàng hoàng (kinh dị, hình sự, hành động...) thì gắn mác.
 *  3. Phim phổ biến trên TMDB (từ PHIEU_PHO_BIEN phiếu) thì gắn mác.
 *  4. Còn lại chặn.
 * Đây chỉ là ĐỀ XUẤT: phim nào cũng vào hàng "chờ duyệt" trong Quản trị.
 */
export function mucTheoTheLoai(
  theLoai: string[],
  them: { soPhieu?: number; ten?: string; tenGoc?: string } = {},
): { muc: Muc18; lyDo: string } {
  const theoTen = them.ten ? xetTen18(them.ten, them.tenGoc) : null
  if (theoTen?.muc === 'chan') {
    // Chỉ hạ chữ đầu: "Tên gốc là mã phim AV" → "tên gốc là mã phim AV", giữ nguyên chữ AV
    return { muc: 'chan', lyDo: `Thể loại 18+ của nguồn, ${theoTen.lyDo[0].toLowerCase()}${theoTen.lyDo.slice(1)}` }
  }
  const dangHoang = theLoai.filter((t) => THE_LOAI_DANG_HOANG.has(t))
  if (dangHoang.length) return { muc: 'canh-bao', lyDo: `Thể loại 18+ của nguồn, nhưng cũng là ${dangHoang.join(', ')}` }
  if ((them.soPhieu ?? 0) >= PHIEU_PHO_BIEN) {
    return { muc: 'canh-bao', lyDo: `Thể loại 18+ của nguồn, nhưng là phim phổ biến (${them.soPhieu} phiếu TMDB)` }
  }
  return { muc: 'chan', lyDo: 'Thể loại 18+ của nguồn' }
}
