/**
 * Phần suy luận thuần của lịch ra tập — không đụng DB, để scripts/kiem-nguon.mjs
 * gọi thẳng được mà kiểm. Phần đọc/ghi DB nằm ở lib/lich-tap.ts.
 */

/** Cần ít nhất bấy nhiêu lần lên tập mới thì mới dám nói thành quy luật. */
export const MAU_TOI_THIEU = 3
const NGAY = 86_400_000
/** Việt Nam không đổi giờ theo mùa, cộng cứng 7 tiếng là ra giờ địa phương. */
const LECH_VN = 7 * 3_600_000
const THU = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']

function trungVi(ds: number[]): number {
  const x = [...ds].sort((a, b) => a - b)
  const g = Math.floor(x.length / 2)
  return x.length % 2 ? x[g] : (x[g - 1] + x[g]) / 2
}

/**
 * Câu mô tả nhịp ra tập từ các mốc (ms), hoặc null khi chưa đủ chắc để nói.
 * Chỉ trả về điều dữ liệu thật sự cho thấy — không đoán cho có.
 */
export function nhipTuMoc(mocVao: number[]): string | null {
  // Khử trùng theo GIÁ TRỊ thời gian, không theo chuỗi: hai nguồn ghi cùng một
  // thời điểm khác nhau ("…+07:00" và "…Z"). Mốc trùng sinh khoảng cách 0 ngày
  // và làm hàm nói nhầm thành "ra tập mỗi ngày".
  const moc = [...new Set(mocVao.filter(Number.isFinite))].sort((a, b) => a - b)
  if (moc.length < MAU_TOI_THIEU) return null

  const khoang = moc.slice(1).map((t, i) => (t - moc[i]) / NGAY)
  if (trungVi(khoang) <= 1.5) return 'Ra tập gần như mỗi ngày'

  const dem = new Map<number, number>()
  for (const t of moc) {
    const thu = new Date(t + LECH_VN).getUTCDay()
    dem.set(thu, (dem.get(thu) || 0) + 1)
  }
  const xep = [...dem.entries()].sort((a, b) => b[1] - a[1])
  const [nhat, nhi] = xep

  /**
   * Hai tập mỗi tuần (Thứ Hai và Thứ Ba...) — gặp nhiều ở phim Hàn. PHẢI xét
   * TRƯỚC luật một thứ: 3 Thứ Hai + 2 Thứ Ba thì Thứ Hai đã chiếm 60%, xét luật
   * một thứ trước là nói sai thành "chỉ Thứ Hai" — bộ kiểm đã bắt được đúng ca này.
   * Thứ nhì phải bằng ít nhất nửa thứ nhất mới tính là ngày chiếu thật, chứ không
   * phải một lần lệch lịch.
   */
  if (nhi && nhi[1] >= 2 && nhi[1] / nhat[1] >= 0.5 && (nhat[1] + nhi[1]) / moc.length >= 0.8) {
    // Xếp theo tuần bắt đầu từ Thứ Hai để câu đọc xuôi
    const [a, b] = [nhat[0], nhi[0]].sort((x, y) => ((x + 6) % 7) - ((y + 6) % 7))
    return `Thường có tập mới vào ${THU[a]} và ${THU[b]}`
  }
  if (nhat[1] / moc.length >= 0.6) return `Thường có tập mới vào ${THU[nhat[0]]}`
  return null
}

/** "vừa xong", "5 giờ trước", "3 ngày trước"; quá một tháng thì ghi ngày. */
export function truocDay(iso: string | undefined, bayGio = Date.now()): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  const phut = Math.round((bayGio - t) / 60_000)
  if (phut < 0) return null
  if (phut < 60) return 'vừa xong'
  const gio = Math.round(phut / 60)
  if (gio < 24) return `${gio} giờ trước`
  const ngay = Math.round(gio / 24)
  if (ngay <= 30) return `${ngay} ngày trước`
  const d = new Date(t + LECH_VN)
  const hai = (n: number) => String(n).padStart(2, '0')
  return `ngày ${hai(d.getUTCDate())}/${hai(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`
}
