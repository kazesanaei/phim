/**
 * Tự cập nhật phim mới vào kho đệm.
 *
 * VÌ SAO CẦN: kho đệm chỉ đầy khi quét trọn danh mục (20–30 phút) hoặc giải nén
 * bản dựng sẵn — cả hai đều là ẢNH CHỤP một lúc. Phim ra sau lúc đó (ví dụ "A
 * Love Other Than Yours", chiếu từ 12/09/2026) không có trong kho, nên ô gợi ý
 * và bộ lọc ở trang tìm (cả hai chỉ đọc kho) không bao giờ thấy.
 *
 * CÁCH LÀM: đọc `/danh-sach/phim-moi-cap-nhat` của mọi nguồn đang bật, từ trang
 * 1 trở đi, ghi vào kho. Danh sách này xếp theo lúc nguồn cập nhật, nên gặp một
 * trang mà phim nào cũng đã có và không lên tập mới là biết phần còn lại đã cũ
 * — dừng. Bình thường chỉ tốn 1–2 lượt gọi mỗi nguồn.
 *
 * Kích hoạt kiểu "lười" như lib/tap-moi.ts: trang chủ và trang tìm gọi hàm này
 * mỗi lần mở, hàm tự bỏ qua nếu lần chạy trước còn mới. Không cần bộ hẹn giờ
 * nào chạy riêng.
 */
import { db, layCaiDat, datCaiDat } from './db'
import * as vsmov from './vsmov'
import * as kkphim from './nguon-kkphim'
import { nguonDangBat, type TenNguon } from './nguon'
import { luuPhimVaoKho } from './kho-nguon'
import { bacBo } from './loc-18'
import type { PhimTom, Trang } from './vsmov'

const KHOA_TRANG_THAI = 'cap_nhat_moi'
/** Bật/tắt tự cập nhật. Mặc định bật. */
const KHOA_BAT = 'cap_nhat_moi_bat'

/** Khoảng cách tối thiểu giữa hai lần tự chạy. */
const CACH_PHUT = 30
/** Lần đầu chưa có mốc nào thì đi sâu hơn để vét phim của vài tuần gần đây. */
const TRANG_LAN_DAU = 30
/** Các lần sau: trần an toàn, phòng khi nguồn đổi thứ tự làm điều kiện dừng không khớp. */
const TRANG_TOI_DA = 10
/** Vòng lặp im lâu hơn thế này coi như đã chết (hot-reload bỏ rơi nó). */
const HAN_NHIP_TIM_MS = 120_000

export type TrangThaiCapNhat = {
  bat: boolean
  dangChay: boolean
  batDauLuc: string | null
  xongLuc: string | null
  /** Phim chưa từng có trong kho. */
  soMoi: number
  /** Phim đã có nhưng vừa lên tập mới. */
  soLenTap: number
  soTrang: number
  loi: string | null
}

const kho = globalThis as unknown as { __capNhatMoi?: { nhip: number } }

function doc(): Omit<TrangThaiCapNhat, 'bat' | 'dangChay'> {
  try {
    const t = JSON.parse(layCaiDat(KHOA_TRANG_THAI, '{}')) as Record<string, unknown>
    return {
      batDauLuc: (t.batDauLuc as string) ?? null,
      xongLuc: (t.xongLuc as string) ?? null,
      soMoi: Number(t.soMoi) || 0,
      soLenTap: Number(t.soLenTap) || 0,
      soTrang: Number(t.soTrang) || 0,
      loi: (t.loi as string) ?? null,
    }
  } catch {
    return { batDauLuc: null, xongLuc: null, soMoi: 0, soLenTap: 0, soTrang: 0, loi: null }
  }
}

function dangChay(): boolean {
  const v = kho.__capNhatMoi
  return !!v && Date.now() - v.nhip < HAN_NHIP_TIM_MS
}

export function trangThaiCapNhat(): TrangThaiCapNhat {
  return { bat: tuCapNhatBat(), dangChay: dangChay(), ...doc() }
}

export function tuCapNhatBat(): boolean {
  return layCaiDat(KHOA_BAT, '1') !== '0'
}

export function datTuCapNhat(bat: boolean) {
  datCaiDat(KHOA_BAT, bat ? '1' : '0')
}

/**
 * So một trang với kho: bao nhiêu phim chưa có, bao nhiêu phim đã có mà số tập
 * đổi. Phải đọc TRƯỚC khi ghi, ghi rồi thì cái gì cũng thành "đã có".
 *
 * Bỏ phim 18+ ra trước khi đếm: luuPhimVaoKho() không bao giờ ghi chúng, nên
 * để lại thì lần nào chúng cũng là "mới" và vòng lặp không bao giờ dừng sớm.
 */
function soVoiKho(tatCa: PhimTom[]): { moi: number; lenTap: number } {
  const ds = tatCa.filter((p) => !bacBo({ slug: p.slug, ten: p.ten, tenGoc: p.tenGoc }))
  if (!ds.length) return { moi: 0, lenTap: 0 }
  const cho = ds.map(() => '?').join(',')
  const daCo = new Map(
    (
      db.prepare(`select slug, tap_hien_tai from kho_phim where slug in (${cho})`).all(...ds.map((p) => p.slug)) as {
        slug: string
        tap_hien_tai: string | null
      }[]
    ).map((h) => [h.slug, h.tap_hien_tai]),
  )
  let moi = 0
  let lenTap = 0
  for (const p of ds) {
    if (!daCo.has(p.slug)) moi++
    else if ((p.tapHienTai ?? null) !== daCo.get(p.slug)) lenTap++
  }
  return { moi, lenTap }
}

const LAY_DANH_SACH: Record<TenNguon, (trang: number) => Promise<Trang>> = {
  vsmov: (t) => vsmov.layDanhSach('phim-moi-cap-nhat', t),
  kkphim: (t) => kkphim.layDanhSach('phim-moi-cap-nhat', t),
}

/**
 * Chạy cập nhật nền. Trả về ngay, không chờ xong.
 * `ep` = true (bấm tay trong Quản trị) thì bỏ qua công tắc và khoảng cách 30 phút.
 */
export function capNhatPhimMoi(ep = false): void {
  if (dangChay()) return
  const cu = doc()
  if (!ep) {
    if (!tuCapNhatBat()) return
    const truoc = cu.batDauLuc ? Date.parse(cu.batDauLuc) : 0
    if (Date.now() - truoc < CACH_PHUT * 60_000) return
  }

  const lanDau = !cu.xongLuc
  const nhip = { nhip: Date.now() }
  kho.__capNhatMoi = nhip
  const batDauLuc = new Date().toISOString()
  // Ghi mốc bắt đầu NGAY: mười người mở trang cùng lúc thì chỉ một vòng chạy.
  datCaiDat(KHOA_TRANG_THAI, JSON.stringify({ ...cu, batDauLuc, loi: null }))

  void (async () => {
    let soMoi = 0
    let soLenTap = 0
    let soTrang = 0
    const loi: string[] = []
    try {
      for (const nguon of nguonDangBat()) {
        const gioiHan = lanDau ? TRANG_LAN_DAU : TRANG_TOI_DA
        for (let trang = 1; trang <= gioiHan; trang++) {
          let kq: Trang
          try {
            kq = await LAY_DANH_SACH[nguon](trang)
          } catch (e) {
            // Một nguồn chết thì vẫn cập nhật nguồn kia
            loi.push(nguon + ': ' + (e instanceof Error ? e.message : String(e)))
            break
          }
          nhip.nhip = Date.now()
          soTrang++
          if (!kq.items.length) break

          const ss = soVoiKho(kq.items)
          luuPhimVaoKho(kq.items)
          soMoi += ss.moi
          soLenTap += ss.lenTap

          if (!lanDau && ss.moi + ss.lenTap === 0) break
          if (trang >= kq.tongTrang) break
          // Nghỉ ngắn giữa các lượt cho nguồn đỡ bị dồn dập
          await new Promise((r) => setTimeout(r, 150))
        }
      }
    } catch (e) {
      loi.push(e instanceof Error ? e.message : String(e))
    } finally {
      datCaiDat(
        KHOA_TRANG_THAI,
        JSON.stringify({
          batDauLuc,
          // Cả hai nguồn đều chết thì đừng coi là "xong", để lần sau còn đi sâu như lần đầu
          xongLuc: soTrang > 0 ? new Date().toISOString() : cu.xongLuc,
          soMoi,
          soLenTap,
          soTrang,
          loi: loi.length ? loi.join(' · ') : null,
        }),
      )
      if (kho.__capNhatMoi === nhip) kho.__capNhatMoi = undefined
    }
  })()
}
