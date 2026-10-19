/**
 * Tua thẳng tới after credit (cảnh sau / giữa phần chạy chữ cuối phim).
 *
 * Cố ý KHÔNG phụ thuộc gì: trình phát (chạy ở trình duyệt) và bộ kiểm (Node
 * thuần, xem bẫy #12 trong README) đều nạp thẳng được tệp này.
 *
 * VÌ SAO ĐÁNH DẤU TAY: không nguồn nào cho mốc after credit. TMDB chỉ có từ
 * khoá "aftercreditsstinger" — cho biết CÓ, không cho biết Ở ĐÂU. Tự dò thì phải
 * nhận ra chữ chạy trên màn hình, tốn hàng phút CPU mỗi phim. Bấm một phím đúng
 * một lần lúc xem là đủ — cùng lý do với mốc intro.
 *
 * KHÁC INTRO Ở CHỖ LƯU THEO TẬP (khoá `slug:tập`), không theo cả phim: intro của
 * một bộ phim giống nhau ở mọi tập, còn after credit mỗi tập một chỗ.
 */

export type MocCredit = {
  /** Chỗ phần chạy chữ bắt đầu — không bắt buộc, giúp nút hiện đúng lúc. */
  batDauCredit: number | null
  /** Đầu từng cảnh after credit, tăng dần. */
  after: number[]
}

export const MOC_CREDIT_RONG: MocCredit = { batDauCredit: null, after: [] }

/** Chưa đánh dấu đầu credit thì nút after credit 1 hiện trước mốc này bấy nhiêu giây. */
export const HIEN_TRUOC_GIAY = 8 * 60
/** Sau khi tới một cảnh after credit, xem chừng này giây rồi mới mời sang cảnh kế. */
export const XEM_CANH_GIAY = 60
/** Hai mốc gần nhau hơn thế này coi là một (bấm phím hai lần liền). */
const GOP_GIAY = 3
/** Trần số mốc mỗi tập — phim nhiều nhất cũng chỉ 2–3 cảnh. */
export const TOI_DA_MOC = 8

/** Làm sạch dữ liệu: số hợp lệ, không âm, tăng dần, bỏ mốc trùng. */
export function chuanHoa(m: Partial<MocCredit> | null | undefined): MocCredit {
  const so = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : null)
  const after: number[] = []
  for (const x of [...(Array.isArray(m?.after) ? m.after : [])].map(so).filter((x): x is number => x !== null).sort((a, b) => a - b)) {
    if (!after.length || x - after[after.length - 1] >= GOP_GIAY) after.push(Math.round(x * 10) / 10)
  }
  const bd = so(m?.batDauCredit)
  return { batDauCredit: bd === null ? null : Math.round(bd * 10) / 10, after: after.slice(0, TOI_DA_MOC) }
}

/** Thêm một mốc after credit (gộp nếu trùng mốc cũ trong vòng vài giây). */
export function themAfter(m: MocCredit, giay: number): MocCredit {
  return chuanHoa({ ...m, after: [...m.after, giay] })
}

export function boAfter(m: MocCredit, chiSo: number): MocCredit {
  return chuanHoa({ ...m, after: m.after.filter((_, i) => i !== chiSo) })
}

/**
 * Nút nào đang nên hiện ở thời điểm `t`, hoặc null.
 *
 *  - Cảnh 1: hiện từ lúc credit bắt đầu (nếu đã đánh dấu), không thì từ
 *    HIEN_TRUOC_GIAY trước cảnh 1 — đủ phủ phần chạy chữ dài nhất thường gặp mà
 *    không lòi ra giữa đoạn kết của phim.
 *  - Cảnh k ≥ 2: hiện sau khi đã xem cảnh trước XEM_CANH_GIAY giây ("xem xong
 *    rồi mới mời đi tiếp"); hai cảnh sát nhau thì hiện ở giữa khoảng.
 *  - Đã tới hoặc qua cảnh cuối thì thôi, nhường chỗ cho nút tập kế.
 */
export function nutAfterCredit(m: MocCredit, t: number): { chiSo: number; den: number } | null {
  const k = m.after.findIndex((x) => x > t + 1)
  if (k < 0) return null
  const den = m.after[k]
  let tu: number
  if (k === 0) {
    tu = m.batDauCredit !== null && m.batDauCredit < den ? m.batDauCredit : den - HIEN_TRUOC_GIAY
  } else {
    const truoc = m.after[k - 1]
    tu = truoc + Math.min(XEM_CANH_GIAY, (den - truoc) / 2)
  }
  return t >= tu ? { chiSo: k, den } : null
}

/** Nhãn nút: chỉ một cảnh thì khỏi đánh số. */
export function nhanNut(m: MocCredit, chiSo: number): string {
  return m.after.length > 1 ? `Tới after credit ${chiSo + 1}` : 'Tới after credit'
}
