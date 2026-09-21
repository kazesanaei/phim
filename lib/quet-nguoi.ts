/**
 * Quét chỉ mục diễn viên / đạo diễn.
 *
 * VÌ SAO PHẢI QUÉT TỪNG PHIM: không nguồn nào cho tìm theo tên người. Đã thử
 * ngày 28/08/2026 — `/dien-vien/<slug>` trả 404, `/tim-kiem?actor=` trả 422, còn
 * `?keyword=Tom Cruise` chỉ khớp TÊN PHIM chứa chuỗi đó. Tên người duy nhất có ở
 * endpoint chi tiết, nên phải gọi một lượt cho mỗi phim trong kho.
 *
 * Đo thực tế trên máy này: khoảng 8,4 người/phim, và tốc độ bị chặn bởi chính
 * nguồn chứ không phải đĩa hay CPU — xem TOC_DO_DO_DUOC ngay dưới.
 *
 * Cấu trúc vòng lặp bám theo lib/kho-nguon.ts: chạy nền, có nhịp tim để phát
 * hiện vòng chết, tạm dừng và chạy tiếp được. Đọc chú thích HAN_NHIP_TIM_MS bên
 * đó để hiểu vì sao cần nhịp tim.
 */
import { db, layCaiDat, datCaiDat } from './db'
import { khongDau } from './khong-dau'
import { layChiTiet } from './vsmov'

const KHOA_TIEN_DO = 'nguoi_tien_do'
const KHOA_TRANG_THAI = 'nguoi_trang_thai'

/** Bao nhiêu phim gọi cùng lúc. Giữ bằng /api/anh — cao hơn là nguồn rớt kết nối. */
const LUONG = 3
/** Nghỉ giữa các lô, cho nguồn đỡ dồn dập. */
const NGHI_MS = 60
/** Gom bao nhiêu phim vào một giao dịch ghi. Cũng là nhịp cập nhật tiến độ. */
const KICH_LO_GHI = 30
/**
 * Tốc độ đo được trên máy này, phim/giây. Dùng để ước tính thời gian còn lại.
 *
 * ĐỪNG tin con số "0,14 giây/phim" từ phép thử 24 phim lúc đầu: mẫu quá nhỏ và
 * toàn phim lẻ payload gọn. Chạy thật trên cả kho (phim bộ có hàng trăm tập
 * trong phần chi tiết) chỉ được ~2,3–2,6 phim/giây, tức khoảng 2 giờ cho
 * 18.719 phim. Đã thử gom giao dịch ghi và tắt Data Cache của Next: cả hai đều
 * không dời được nút thắt, vì nút thắt là thời gian đáp của chính nguồn ở mức
 * 3 luồng.
 */
export const TOC_DO_DO_DUOC = 2.4

const HAN_NHIP_TIM_MS = 90_000

const kho = globalThis as unknown as { __quetNguoi?: { dung: boolean } }

export type TienDoNguoi = {
  dangChay: boolean
  treo: boolean
  daQuet: number
  tongPhim: number
  soNguoi: number
  soTen: number
  batDauLuc: string | null
  loi: string | null
}

function conSong(t: Record<string, unknown>): boolean {
  const nhip = Number(t.nhipTim) || 0
  return nhip > 0 && Date.now() - nhip < HAN_NHIP_TIM_MS
}

function dem(sql: string): number {
  try {
    return (db.prepare(sql).get() as { n: number }).n
  } catch {
    return 0
  }
}

export function tienDoQuetNguoi(): TienDoNguoi {
  let t: Record<string, unknown> = {}
  try {
    t = JSON.parse(layCaiDat(KHOA_TIEN_DO, '{}'))
  } catch {
    t = {}
  }
  const coCo = layCaiDat(KHOA_TRANG_THAI, '') === 'dang'
  const song = conSong(t)
  return {
    dangChay: coCo && song,
    treo: coCo && !song,
    daQuet: dem('select count(*) as n from nguoi_da_quet'),
    tongPhim: dem('select count(*) as n from kho_phim'),
    soNguoi: dem('select count(*) as n from nguoi_phim'),
    soTen: dem('select count(distinct khong_dau) as n from nguoi_phim'),
    batDauLuc: (t.batDauLuc as string) ?? null,
    loi: (t.loi as string) ?? null,
  }
}

function ghiTienDo(t: Record<string, unknown>) {
  let cu: Record<string, unknown> = {}
  try {
    cu = JSON.parse(layCaiDat(KHOA_TIEN_DO, '{}'))
  } catch {
    cu = {}
  }
  datCaiDat(KHOA_TIEN_DO, JSON.stringify({ ...cu, ...t }))
}

export function dungQuetNguoi() {
  if (kho.__quetNguoi) kho.__quetNguoi.dung = true
  datCaiDat(KHOA_TRANG_THAI, 'dung')
}

export function xoaChiMucNguoi() {
  dungQuetNguoi()
  db.exec('delete from nguoi_phim; delete from nguoi_da_quet;')
  datCaiDat(KHOA_TIEN_DO, '{}')
  datCaiDat(KHOA_TRANG_THAI, '')
}

/* ------------------------------------------------------------------ */

/** Tên người từ nguồn rất bẩn: rỗng, "N/A", cả cụm dính dấu phẩy. Tách và lọc. */
function tachTen(tho: unknown): string[] {
  if (!Array.isArray(tho)) return []
  const ra = new Set<string>()
  for (const x of tho) {
    if (typeof x !== 'string') continue
    for (const phan of x.split(/[,;|]/)) {
      const t = phan.replace(/\s+/g, ' ').trim()
      if (!t || t.length > 80) continue
      if (/^(n\/a|updating|dang cap nhat|đang cập nhật|unknown)$/i.test(t)) continue
      ra.add(t)
    }
  }
  return [...ra]
}

const themNguoi = () =>
  db.prepare(
    `insert into nguoi_phim (slug_phim, ten, khong_dau, loai) values (?, ?, ?, ?)
     on conflict(slug_phim, ten, loai) do nothing`,
  )
const danhDauQuet = () =>
  db.prepare(
    `insert into nguoi_da_quet (slug_phim, so_nguoi, quet_luc) values (?, ?, datetime('now'))
     on conflict(slug_phim) do update set so_nguoi = excluded.so_nguoi, quet_luc = datetime('now')`,
  )

type NguoiCuaMotPhim = { slug: string; ten: string[]; daoDien: string[] }

/** Chỉ gọi mạng, không đụng DB — để phần ghi gom lại một lượt. */
async function layNguoi(slug: string): Promise<NguoiCuaMotPhim> {
  const ct = await layChiTiet(slug, false)
  // Phim chết ở nguồn vẫn trả về rỗng chứ không ném lỗi: nó phải được đánh dấu
  // đã quét, không thì vòng lặp quay lại mãi một phim hỏng.
  return { slug, ten: ct ? tachTen(ct.dienVien) : [], daoDien: ct ? tachTen(ct.daoDien) : [] }
}

/**
 * Ghi cả lô trong MỘT giao dịch.
 *
 * VÌ SAO GOM: mỗi phim có ~9 câu ghi, để rời thì mỗi câu là một giao dịch riêng
 * và WAL phải đồng bộ xuống đĩa từng lần. Đo thật: ghi rời 2,25 phim/giây, gom
 * lô 2,63 — nhanh hơn ~17%. Không nhiều, vì nút thắt nằm ở nguồn chứ không ở
 * đĩa; nhưng đây là phần rẻ nhất để lấy, nên vẫn giữ.
 */
function ghiLoNguoi(lo: NguoiCuaMotPhim[]) {
  const cauNguoi = themNguoi()
  const cauDau = danhDauQuet()
  db.exec('begin')
  try {
    for (const p of lo) {
      let n = 0
      for (const [ds, loai] of [
        [p.ten, 'dv'],
        [p.daoDien, 'dd'],
      ] as [string[], string][]) {
        for (const ten of ds) {
          cauNguoi.run(p.slug, ten, khongDau(ten), loai)
          n++
        }
      }
      cauDau.run(p.slug, n)
    }
    db.exec('commit')
  } catch (e) {
    db.exec('rollback')
    throw e
  }
}

/** Lấy người của một phim rồi ghi ngay. Dùng cho đường lẻ, không phải vòng quét. */
export async function napNguoiChoPhim(slug: string): Promise<number> {
  const p = await layNguoi(slug)
  ghiLoNguoi([p])
  return p.ten.length + p.daoDien.length
}

/**
 * Chạy quét nền. Trả về ngay, không chờ xong.
 * `lamLai` = true thì xoá dấu đã quét, đi lại từ đầu.
 */
export async function batDauQuetNguoi(lamLai = false): Promise<void> {
  if (tienDoQuetNguoi().dangChay) return

  const co = { dung: false }
  kho.__quetNguoi = co
  datCaiDat(KHOA_TRANG_THAI, 'dang')
  if (lamLai) db.exec('delete from nguoi_da_quet')
  ghiTienDo({ batDauLuc: new Date().toISOString(), loi: null, nhipTim: Date.now() })

  void (async () => {
    try {
      // Ưu tiên phim điểm cao: dừng giữa chừng thì phần đã có vẫn là phần hay tra nhất.
      const layLo = db.prepare(
        `select k.slug from kho_phim k
         left join nguoi_da_quet d on d.slug_phim = k.slug
         where d.slug_phim is null
         order by k.diem desc nulls last, k.so_phieu desc
         limit ?`,
      )

      for (;;) {
        if (co.dung) break
        const lo = layLo.all(120) as { slug: string }[]
        if (!lo.length) break

        // Lấy mạng theo lô lớn rồi ghi một lượt: gộp được nhiều phim vào cùng
        // một giao dịch, đó là chỗ ăn thời gian chính (xem chú thích ghiLoNguoi).
        for (let i = 0; i < lo.length; i += KICH_LO_GHI) {
          if (co.dung) break
          const phanLo = lo.slice(i, i + KICH_LO_GHI)
          const ra: NguoiCuaMotPhim[] = []

          for (let j = 0; j < phanLo.length; j += LUONG) {
            if (co.dung) break
            const nhom = await Promise.all(
              phanLo.slice(j, j + LUONG).map(async (p) => {
                try {
                  return await layNguoi(p.slug)
                } catch {
                  // Một phim hỏng không đáng để dừng cả vòng; lần sau gặp lại.
                  return null
                }
              }),
            )
            for (const x of nhom) if (x) ra.push(x)
            await new Promise((r) => setTimeout(r, NGHI_MS))
          }

          if (ra.length) ghiLoNguoi(ra)
          ghiTienDo({ nhipTim: Date.now() })
        }
      }

      datCaiDat(KHOA_TRANG_THAI, co.dung ? 'dung' : 'xong')
    } catch (e) {
      ghiTienDo({ loi: e instanceof Error ? e.message : String(e) })
      datCaiDat(KHOA_TRANG_THAI, 'loi')
    }
  })()
}

/* ------------------------------------------------------------------ */
/* Tra cứu                                                             */
/* ------------------------------------------------------------------ */

export type TenNguoi = { ten: string; loai: string; soPhim: number }

/** Gợi ý tên người khớp từ khoá — dùng cho ô tìm kiếm và trang kết quả. */
export function timTenNguoi(tuKhoa: string, gioiHan = 8): TenNguoi[] {
  const kd = khongDau(tuKhoa).trim()
  if (kd.length < 2) return []
  try {
    return db
      .prepare(
        `select ten, loai, count(*) as soPhim from nguoi_phim
         where khong_dau like ?
         group by khong_dau, loai
         order by (case when khong_dau = ? then 0 when khong_dau like ? then 1 else 2 end), soPhim desc
         limit ?`,
      )
      .all('%' + kd + '%', kd, kd + '%', gioiHan) as never
  } catch {
    return []
  }
}

/** Slug các phim có người khớp từ khoá. */
export function phimTheoNguoi(tuKhoa: string, gioiHan = 120): string[] {
  const kd = khongDau(tuKhoa).trim()
  if (kd.length < 2) return []
  try {
    const hang = db
      .prepare(
        `select distinct slug_phim from nguoi_phim
         where khong_dau = ? or khong_dau like ?
         limit ?`,
      )
      .all(kd, '%' + kd + '%', gioiHan) as { slug_phim: string }[]
    return hang.map((h) => h.slug_phim)
  } catch {
    return []
  }
}

/** Người của một phim, để trang chi tiết bấm được vào từng tên. */
export function nguoiCuaPhim(slug: string): { dienVien: string[]; daoDien: string[] } {
  try {
    const hang = db.prepare('select ten, loai from nguoi_phim where slug_phim = ?').all(slug) as {
      ten: string
      loai: string
    }[]
    return {
      dienVien: hang.filter((h) => h.loai === 'dv').map((h) => h.ten),
      daoDien: hang.filter((h) => h.loai === 'dd').map((h) => h.ten),
    }
  } catch {
    return { dienVien: [], daoDien: [] }
  }
}

export function coChiMucNguoi(): boolean {
  return dem('select count(*) as n from nguoi_phim') > 0
}

/**
 * Phim khác có chung diễn viên / đạo diễn với phim này.
 *
 * Xếp theo SỐ NGƯỜI TRÙNG giảm dần: hai phim chung ba diễn viên gần nhau hơn
 * hẳn hai phim chung một người. Bỏ chính nó và các phần khác của cùng bộ phim
 * (so bằng `goc_khong_dau`) — "Người Nhện phần 2" nằm trong ô "phần khác" ở
 * trên rồi, lặp lại ở đây chỉ tổ chật chỗ.
 */
export function phimCungNguoi(slug: string, gioiHan = 12): { slug: string; chung: string[] }[] {
  try {
    const hang = db
      .prepare(
        `with nguoi_cua_no as (select khong_dau from nguoi_phim where slug_phim = ?),
              goc_cua_no as (select goc_khong_dau from kho_phim where slug = ?)
         select n.slug_phim as slug, group_concat(distinct n.ten) as chung, count(distinct n.khong_dau) as sn
           from nguoi_phim n
           join kho_phim k on k.slug = n.slug_phim
          where n.khong_dau in (select khong_dau from nguoi_cua_no)
            and n.slug_phim <> ?
            and (k.goc_khong_dau is null
                 or k.goc_khong_dau <> (select goc_khong_dau from goc_cua_no))
          group by n.slug_phim
          order by sn desc, k.so_phieu desc
          limit ?`,
      )
      .all(slug, slug, slug, gioiHan) as { slug: string; chung: string; sn: number }[]
    return hang.map((h) => ({ slug: h.slug, chung: (h.chung || '').split(',').slice(0, 3) }))
  } catch {
    return []
  }
}

/**
 * "Vì bạn đã xem <phim>": lấy phim gần đây nhất trong lịch sử rồi gợi ý những
 * phim chung diễn viên / đạo diễn với nó.
 *
 * VÌ SAO GỌI TÊN PHIM CỤ THỂ: trang chủ đang có "Vì bạn hay xem <thể loại>",
 * nhưng thể loại thì mơ hồ — "Chính Kịch" chẳng nói lên điều gì. Nêu đích danh
 * bộ phim vừa xem thì người ta hiểu ngay vì sao được gợi ý thứ này.
 *
 * Bỏ phim đã xem rồi: gợi lại đúng thứ vừa xem xong là vô nghĩa.
 */
export function goiYTheoPhimDaXem(gioiHan = 2): { slug: string; ten: string; goiY: string[] }[] {
  try {
    const nguon = db
      .prepare(
        `select x.slug, coalesce(k.ten, x.ten) as ten from xem x
           join kho_phim k on k.slug = x.slug
          where x.vi_tri > 120
          group by x.slug
          order by max(x.cap_nhat) desc
          limit ?`,
      )
      .all(gioiHan) as { slug: string; ten: string }[]

    const daXem = new Set(
      (db.prepare('select distinct slug from xem').all() as { slug: string }[]).map((r) => r.slug),
    )

    return nguon
      .map((p) => ({
        slug: p.slug,
        ten: p.ten,
        goiY: phimCungNguoi(p.slug, 20)
          .map((x) => x.slug)
          .filter((s) => !daXem.has(s))
          .slice(0, 14),
      }))
      .filter((x) => x.goiY.length >= 4)
  } catch {
    return []
  }
}
