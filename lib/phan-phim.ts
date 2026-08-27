/**
 * Gom các phần/season của cùng một phim thành một mục.
 *
 * Nguồn trả mỗi phần là một phim riêng ("Gia Đình Heck - Phần 1..9" = 9 mục),
 * nên lưới duyệt bị lặp cùng một poster chín lần. Ở đây tách phần khỏi tên rồi
 * gom lại, giữ nguyên thứ tự xuất hiện đầu tiên của mỗi nhóm.
 *
 * Tách theo TÊN TIẾNG VIỆT chứ không theo origin_name: tên Việt luôn sạch
 * ("- Phần 4"), còn tên gốc lắm khi lằng nhằng ("4th Season: Second Year,
 * First Semester").
 */
import { khongDau } from './khong-dau'
import { tachPhan } from './ten-phan'
import { timKiem, type PhimTom } from './vsmov'

export { tachPhan }
export type { TenPhan } from './ten-phan'

export type NhomPhim = {
  /** Tên chung, đã bỏ đuôi "- Phần N" */
  ten: string
  /** Mục dùng để hiển thị thẻ (phần nhỏ nhất, ưu tiên phần có poster) */
  daiDien: PhimTom
  /** Các phần đã sắp theo số, chỉ có ý nghĩa khi soPhan > 1 */
  cacPhan: { phim: PhimTom; so: number | null }[]
  soPhan: number
}

/**
 * Gom danh sách phim thành nhóm. Nhóm chỉ có 1 mục thì coi như phim thường.
 *
 * Giới hạn: chỉ gom trong phạm vi danh sách được truyền vào (thường là một
 * trang kết quả). Các phần nằm ở trang khác không gom được — nguồn sắp theo
 * thời gian cập nhật nên các phần của một phim thường nằm cạnh nhau, còn danh
 * sách phần đầy đủ thì trang chi tiết tự tra lại bằng timCacPhan().
 */
export function gomPhan(items: PhimTom[]): NhomPhim[] {
  const theoKhoa = new Map<string, NhomPhim>()
  const thuTu: string[] = []

  for (const p of items) {
    const { goc, phan } = tachPhan(p.ten)
    const khoa = khongDau(goc)
    if (!khoa) continue

    let nhom = theoKhoa.get(khoa)
    if (!nhom) {
      nhom = { ten: goc, daiDien: p, cacPhan: [], soPhan: 0 }
      theoKhoa.set(khoa, nhom)
      thuTu.push(khoa)
    }
    nhom.cacPhan.push({ phim: p, so: phan })
  }

  const ra: NhomPhim[] = []
  for (const khoa of thuTu) {
    const nhom = theoKhoa.get(khoa)!
    nhom.cacPhan.sort((a, b) => (a.so ?? 0) - (b.so ?? 0))
    nhom.soPhan = nhom.cacPhan.length
    // Đại diện: phần nhỏ nhất có poster, không có thì phần nhỏ nhất.
    nhom.daiDien = (nhom.cacPhan.find((x) => x.phim.poster) ?? nhom.cacPhan[0]).phim
    ra.push(nhom)
  }
  return ra
}

/**
 * Tra lại nguồn để lấy ĐẦY ĐỦ các phần của một phim, dùng ở trang chi tiết.
 * Danh sách trang duyệt chỉ gom được những phần rơi vào cùng một trang.
 */
export async function timCacPhan(ten: string): Promise<{ phim: PhimTom; so: number | null }[]> {
  const { goc } = tachPhan(ten)
  const chuan = khongDau(goc)
  if (!chuan) return []
  try {
    const kq = await timKiem(goc, 1, 40)
    const thay = new Map<string, { phim: PhimTom; so: number | null }>()
    for (const p of kq.items) {
      const t = tachPhan(p.ten)
      if (khongDau(t.goc) !== chuan) continue
      if (!thay.has(p.slug)) thay.set(p.slug, { phim: p, so: t.phan })
    }
    const ds = [...thay.values()].sort((a, b) => (a.so ?? 0) - (b.so ?? 0))
    return ds.length > 1 ? ds : []
  } catch {
    return []
  }
}
