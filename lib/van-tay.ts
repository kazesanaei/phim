/**
 * So hai dấu vân tay âm thanh (chromaprint thô) để tìm đoạn hai tập dùng chung —
 * chính là nhạc mở đầu và nhạc kết của phim bộ.
 *
 * Phần thuần, KHÔNG phụ thuộc gì, để scripts/kiem-nguon.mjs nạp thẳng mà kiểm.
 * Phần tải luồng + chạy ffmpeg nằm ở lib/tu-dong-intro.ts.
 *
 * Cách làm giống plugin Intro Skipper của Jellyfin: chromaprint cắt âm thanh
 * thành các khung ~0,124 giây, mỗi khung một số 32 bit. Cùng một đoạn nhạc thì
 * hai số gần như trùng bit. Trượt hai chuỗi qua nhau ở mọi độ lệch, đánh dấu các
 * khung sai ít bit, lấy chuỗi liên tiếp dài nhất.
 *
 * Thử trên phim thật trước khi viết (07/10/2026):
 *   Đảo Hải Tặc 1150/1151 → intro 0:00–1:40, kết 21:30–23:00
 *   Doraemon 1/2          → intro 0:00–1:13, kết 22:49–23:49
 *   30 Rock 3/4           → thẻ tựa 7,6 giây ở 0:56 tập này, 0:27 tập kia
 * Ca 30 Rock là lý do mốc lưu THEO TỪNG TẬP (có cảnh mở màn trước tựa), và lý do
 * có ngưỡng độ dài tối thiểu: đoạn trùng vài giây không đáng bỏ qua.
 */

/** Giây ứng với một khung vân tay: 4096/3 mẫu ở 11025 Hz. */
export const GIAY_MOI_KHUNG = 4096 / 3 / 11025

/** Một khung coi là "khớp" khi hai số khác nhau không quá bấy nhiêu bit (trên 32). */
const TOI_DA_BIT = 10
/** Cho phép vài khung lệch giữa đoạn khớp (tiếng hội thoại đè lên nhạc...). */
const LO_HONG = 6

/** Intro ngắn hơn thế này thì không đáng bỏ qua — và dễ là trùng nhầm khoảng lặng. */
export const INTRO_NGAN_NHAT = 15
export const INTRO_DAI_NHAT = 180
export const KET_NGAN_NHAT = 20
export const KET_DAI_NHAT = 300

function demBit(x: number): number {
  x = x - ((x >>> 1) & 0x55555555)
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333)
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24
}

export type DoanChung = {
  /** Số khung của đoạn chung dài nhất; 0 = không có. */
  dai: number
  aTu: number
  aDen: number
  bTu: number
  bDen: number
}

/** Đoạn liên tiếp dài nhất mà hai chuỗi vân tay cùng có, ở bất kỳ độ lệch nào. */
export function timDoanChung(a: ArrayLike<number>, b: ArrayLike<number>): DoanChung {
  let tot: DoanChung = { dai: 0, aTu: 0, aDen: 0, bTu: 0, bDen: 0 }
  for (let lech = -b.length + 1; lech < a.length; lech++) {
    let batDau = -1
    let cuoiKhop = -1
    const tu = Math.max(0, lech)
    const den = Math.min(a.length, b.length + lech)
    for (let i = tu; i < den; i++) {
      if (demBit(a[i] ^ b[i - lech]) > TOI_DA_BIT) continue
      if (batDau < 0 || i - cuoiKhop > LO_HONG) batDau = i
      cuoiKhop = i
      const dai = cuoiKhop - batDau + 1
      if (dai > tot.dai) tot = { dai, aTu: batDau, aDen: cuoiKhop, bTu: batDau - lech, bDen: cuoiKhop - lech }
    }
  }
  return tot
}

export type Khoang = { tu: number; den: number }

/**
 * Đổi đoạn chung thành khoảng giây cho từng tập, hoặc null nếu không đáng tin.
 * `lechA` / `lechB`: giây bắt đầu của khúc âm thanh đã đem so trong mỗi tập
 * (0 cho khúc đầu tập, "thời lượng − độ dài khúc" cho khúc cuối tập).
 */
export function doiRaGiay(
  d: DoanChung,
  lechA: number,
  lechB: number,
  ngan: number,
  dai: number,
): { a: Khoang; b: Khoang } | null {
  const giay = (d.dai * GIAY_MOI_KHUNG)
  if (!d.dai || giay < ngan || giay > dai) return null
  // +1 khung ở đầu cuối: chỉ số trỏ vào khung cuối cùng khớp, còn khoảng thì
  // phải phủ hết khung đó.
  return {
    a: { tu: lechA + d.aTu * GIAY_MOI_KHUNG, den: lechA + (d.aDen + 1) * GIAY_MOI_KHUNG },
    b: { tu: lechB + d.bTu * GIAY_MOI_KHUNG, den: lechB + (d.bDen + 1) * GIAY_MOI_KHUNG },
  }
}
