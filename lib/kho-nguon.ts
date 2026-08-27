/**
 * Quét kho đệm metadata từ nguồn vsmov vào SQLite.
 *
 * VÌ SAO QUÉT THEO THỂ LOẠI: endpoint danh sách không trả trường thể loại, mà
 * gọi endpoint chi tiết cho 18k phim thì bất khả thi. Quét `/the-loai/{slug}`
 * thì mỗi trang vừa cho dữ liệu phim vừa ngầm cho biết phim thuộc thể loại đó
 * — một công đôi việc, và hợp lại là gần trọn danh mục.
 *
 * Chạy nền, tạm dừng/chạy tiếp được, tiến độ ghi vào bảng cai_dat nên khởi động
 * lại không phải quét từ đầu.
 */
import { db, layCaiDat, datCaiDat } from './db'
import { khongDau } from './khong-dau'
import { layDanhMuc, duyet, type PhimTom } from './vsmov'
import { tachPhan } from './ten-phan'
import { bacBo } from './loc-18'

const KHOA_TIEN_DO = 'kho_tien_do'
const KHOA_TRANG_THAI = 'kho_trang_thai'

export type TienDoQuet = {
  dangChay: boolean
  /** Cờ 'dang' còn trong DB nhưng nhịp tim đã tắt — vòng lặp chết giữa chừng. */
  treo: boolean
  theLoaiXong: string[]
  theLoaiHienTai: string | null
  trangHienTai: number
  tongTrangTheLoai: number
  soPhim: number
  batDauLuc: string | null
  loi: string | null
}

/**
 * Vòng quét nền RẤT dễ chết mà không ai biết: sửa file lúc đang chạy là Next
 * hot-reload module, vòng lặp thuộc bản cũ bị bỏ rơi — nhưng cờ 'dang' trong DB
 * thì vẫn còn, nên lần gọi sau bị từ chối khởi động và nó treo vĩnh viễn.
 * (Đã xảy ra thật: đứng im 30 phút ở 11/45 thể loại.)
 *
 * Nhịp tim ghi mỗi trang. Quá hạn này mà không có nhịp mới thì coi như đã chết
 * và cho phép chạy lại.
 */
const HAN_NHIP_TIM_MS = 90_000

const kho = globalThis as unknown as { __quetNguon?: { dung: boolean } }

/** Nhịp tim còn tươi không? */
function conSong(t: Record<string, unknown>): boolean {
  const nhip = Number(t.nhipTim) || 0
  return nhip > 0 && Date.now() - nhip < HAN_NHIP_TIM_MS
}

function docTienDo(): TienDoQuet {
  let t: Record<string, unknown> = {}
  try {
    t = JSON.parse(layCaiDat(KHOA_TIEN_DO, '{}'))
  } catch {
    t = {}
  }
  const coCo = layCaiDat(KHOA_TRANG_THAI, '') === 'dang'
  const song = conSong(t)
  return {
    // Chỉ coi là đang chạy khi CẢ cờ lẫn nhịp tim đều còn — cờ một mình
    // không đủ, vì vòng lặp chết vẫn để lại cờ.
    dangChay: coCo && song,
    treo: coCo && !song,
    theLoaiXong: Array.isArray(t.theLoaiXong) ? (t.theLoaiXong as string[]) : [],
    theLoaiHienTai: (t.theLoaiHienTai as string) ?? null,
    trangHienTai: Number(t.trangHienTai) || 0,
    tongTrangTheLoai: Number(t.tongTrangTheLoai) || 0,
    soPhim: demKho(),
    batDauLuc: (t.batDauLuc as string) ?? null,
    loi: (t.loi as string) ?? null,
  }
}

function ghiTienDo(t: Partial<TienDoQuet>) {
  const cu = JSON.parse(layCaiDat(KHOA_TIEN_DO, '{}'))
  datCaiDat(KHOA_TIEN_DO, JSON.stringify({ ...cu, ...t }))
}

export function demKho(): number {
  try {
    return (db.prepare('select count(*) as n from kho_phim').get() as { n: number }).n
  } catch {
    return 0
  }
}

export function tienDoQuet(): TienDoQuet {
  return docTienDo()
}

const themPhim = () =>
  db.prepare(
    `insert into kho_phim
       (slug, ten, ten_goc, nam, poster, anh_ngang, loai, chat_luong, tap_hien_tai,
        diem, so_phieu, ten_khong_dau, goc_ten, goc_khong_dau, so_phan, cap_nhat)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     on conflict(slug) do update set
       ten = excluded.ten, ten_goc = excluded.ten_goc, nam = excluded.nam,
       poster = excluded.poster, anh_ngang = excluded.anh_ngang, loai = excluded.loai,
       chat_luong = excluded.chat_luong, tap_hien_tai = excluded.tap_hien_tai,
       diem = excluded.diem, so_phieu = excluded.so_phieu,
       ten_khong_dau = excluded.ten_khong_dau, goc_ten = excluded.goc_ten,
       goc_khong_dau = excluded.goc_khong_dau, so_phan = excluded.so_phan,
       cap_nhat = datetime('now')`,
  )

/**
 * node:sqlite chỉ nhận null / number / string / bigint / Uint8Array. Bất kỳ
 * `undefined`, boolean hay object nào lọt vào là ném "cannot be bound to
 * SQLite parameter N" — mà N thì không cho biết trường nào. Ép kiểu tại đây
 * để dữ liệu nguồn có lạ tới đâu cũng không làm gãy cả vòng quét.
 */
function chuoiHoacNull(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  return typeof v === 'string' ? v : String(v)
}

function soHoacNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function luuPhimVaoKho(ds: PhimTom[], slugTheLoai?: string) {
  const cauPhim = themPhim()
  const cauTL = db.prepare('insert or ignore into kho_the_loai (slug_phim, slug_the_loai) values (?, ?)')
  for (const p of ds) {
    if (!p.slug) continue
    const ten = chuoiHoacNull(p.ten) ?? p.slug
    // Chặn 18+ ngay từ lúc GHI: không để nội dung người lớn nằm trong kho,
    // như vậy mọi truy vấn sau này đều sạch mà không phải nhớ lọc lại.
    if (bacBo({ slug: p.slug, ten, tenGoc: p.tenGoc })) continue
    const t = tachPhan(ten)
    try {
      cauPhim.run(
        String(p.slug),
        ten,
        chuoiHoacNull(p.tenGoc),
        soHoacNull(p.nam),
        chuoiHoacNull(p.poster),
        chuoiHoacNull(p.anhNgang),
        chuoiHoacNull(p.loai),
        chuoiHoacNull(p.chatLuong),
        chuoiHoacNull(p.tapHienTai),
        soHoacNull(p.diem),
        soHoacNull(p.soPhieu) ?? 0,
        khongDau(ten),
        t.goc,
        khongDau(t.goc),
        soHoacNull(t.phan),
      )
    } catch (e) {
      // Một phim lỗi không đáng để hỏng cả vòng quét — bỏ qua và đi tiếp.
      console.warn('[kho] bỏ qua', p.slug, e instanceof Error ? e.message : e)
      continue
    }
    if (slugTheLoai) cauTL.run(String(p.slug), slugTheLoai)
  }
}

/** Dừng vòng quét đang chạy (nếu có). */
export function dungQuet() {
  if (kho.__quetNguon) kho.__quetNguon.dung = true
  datCaiDat(KHOA_TRANG_THAI, 'dung')
}

export function xoaKho() {
  dungQuet()
  db.exec('delete from kho_the_loai; delete from kho_phim;')
  datCaiDat(KHOA_TIEN_DO, '{}')
  datCaiDat(KHOA_TRANG_THAI, '')
}

/**
 * Chạy quét nền. Trả về ngay, không chờ xong.
 * `lamLai` = true thì bỏ tiến độ cũ, quét lại từ thể loại đầu.
 */
export async function batDauQuet(lamLai = false): Promise<void> {
  // Chỉ từ chối khi vòng cũ THẬT SỰ còn sống. Cờ 'dang' còn sót lại từ một vòng
  // đã chết thì phải cho chạy lại, không thì treo vĩnh viễn.
  if (docTienDo().dangChay) return

  const co = { dung: false }
  kho.__quetNguon = co
  datCaiDat(KHOA_TRANG_THAI, 'dang')
  if (lamLai) ghiTienDo({ theLoaiXong: [], theLoaiHienTai: null, trangHienTai: 0, loi: null })
  ghiTienDo({ batDauLuc: new Date().toISOString(), loi: null, nhipTim: Date.now() } as never)

  // Không await: để route trả lời ngay, vòng quét chạy tiếp phía sau.
  void (async () => {
    try {
      const dm = await layDanhMuc()
      const xong = new Set(docTienDo().theLoaiXong)

      for (const tl of dm.theLoai) {
        if (co.dung) break
        if (xong.has(tl.slug)) continue

        let trang = docTienDo().theLoaiHienTai === tl.slug ? docTienDo().trangHienTai || 1 : 1
        let tongTrang = 1

        do {
          if (co.dung) break
          const kq = await duyet({ theLoai: tl.slug, trang })
          tongTrang = kq.tongTrang
          luuPhimVaoKho(kq.items, tl.slug)
          ghiTienDo({
            theLoaiHienTai: tl.slug,
            trangHienTai: trang,
            tongTrangTheLoai: tongTrang,
            nhipTim: Date.now(),
          } as Partial<TienDoQuet> & { nhipTim: number })
          trang++
          // Nghỉ ngắn giữa các lượt cho nguồn đỡ bị dồn dập
          await new Promise((r) => setTimeout(r, 120))
        } while (trang <= tongTrang)

        if (!co.dung) {
          xong.add(tl.slug)
          ghiTienDo({ theLoaiXong: [...xong], theLoaiHienTai: null, trangHienTai: 0 })
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
/* Truy vấn kho — đây là phần mở khoá sắp xếp và lọc nhiều thể loại     */
/* ------------------------------------------------------------------ */

export type LocKho = {
  tim?: string
  theLoai?: string[]
  nam?: string
  loai?: string
  sapXep?: 'diem' | 'nam' | 'ten' | 'moi'
  trang?: number
  moiTrang?: number
  /** Gộp các phần thành một dòng (chỉ giữ phần nhỏ nhất của mỗi phim). */
  gomPhan?: boolean
}

export type HangKho = {
  slug: string
  ten: string
  ten_goc: string | null
  nam: number | null
  poster: string | null
  anh_ngang: string | null
  loai: string | null
  chat_luong: string | null
  tap_hien_tai: string | null
  diem: number | null
  so_phieu: number
  goc_ten: string | null
  so_phan: number | null
  tong_phan?: number
}

/**
 * Số phiếu tối thiểu để một điểm số được tin hoàn toàn. Dưới ngưỡng này, điểm
 * bị kéo về trung bình chung theo tỉ lệ.
 */
const PHIEU_CHUAN = 200

/**
 * Xếp hạng có trọng số (kiểu IMDb):  (v/(v+m))·R + (m/(v+m))·C
 *
 * VÌ SAO KHÔNG SẮP THẲNG THEO `diem`: đo thực tế trên kho, top toàn phim 10
 * điểm từ 1–2 phiếu — một bảng xếp hạng vô nghĩa. Công thức này không LOẠI phim
 * ít phiếu (nhiều phim Việt/châu Á vốn ít phiếu TMDB) mà chỉ kéo chúng về gần
 * trung bình, nên phim thật sự hay vẫn nổi lên.
 */
function bieuThucHang(trungBinh: number): string {
  const m = PHIEU_CHUAN
  return `((so_phieu * 1.0 / (so_phieu + ${m})) * coalesce(diem, ${trungBinh})
           + (${m}.0 / (so_phieu + ${m})) * ${trungBinh}) desc`
}

function diemTrungBinh(): number {
  try {
    const r = db
      .prepare(`select avg(diem) as tb from kho_phim where diem is not null and so_phieu >= ${PHIEU_CHUAN}`)
      .get() as { tb: number | null }
    return r.tb && Number.isFinite(r.tb) ? r.tb : 6.5
  } catch {
    return 6.5
  }
}

function cauSapXep(kieu: string | undefined): string {
  switch (kieu) {
    case 'diem':
      return bieuThucHang(diemTrungBinh())
    case 'nam':
      return 'nam desc nulls last, so_phieu desc'
    case 'ten':
      return 'ten collate nocase asc'
    default:
      return 'cap_nhat desc'
  }
}

export function locKho(loc: LocKho): { items: HangKho[]; tongSo: number; tongTrang: number; trang: number } {
  const dk: string[] = []
  const ts: (string | number)[] = []

  if (loc.tim?.trim()) {
    dk.push("(ten_khong_dau like ? or lower(coalesce(ten_goc, '')) like ?)")
    const k = '%' + khongDau(loc.tim) + '%'
    ts.push(k, k)
  }
  if (loc.nam) {
    dk.push('nam = ?')
    ts.push(Number(loc.nam))
  }
  if (loc.loai === 'le' || loc.loai === 'bo') {
    dk.push('loai = ?')
    ts.push(loc.loai)
  }
  // Lọc NHIỀU thể loại cùng lúc — nguồn không làm được việc này
  for (const tl of loc.theLoai ?? []) {
    if (!tl) continue
    dk.push('exists (select 1 from kho_the_loai k where k.slug_phim = kho_phim.slug and k.slug_the_loai = ?)')
    ts.push(tl)
  }

  const dau = dk.length ? ' where ' + dk.join(' and ') : ''
  const sap = cauSapXep(loc.sapXep)
  const moiTrang = loc.moiTrang || 24
  const trang = Math.max(1, loc.trang || 1)

  if (loc.gomPhan) {
    // Mỗi phim một dòng: giữ phần có điểm cao nhất, kèm tổng số phần đếm được.
    const tongSo = (
      db
        .prepare(`select count(distinct coalesce(goc_khong_dau, slug)) as n from kho_phim${dau}`)
        .get(...ts) as { n: number }
    ).n
    // SQLite có phép mở rộng: khi dùng max()/min() trong SELECT kèm GROUP BY thì
    // các cột trần lấy đúng từ HÀNG đạt cực trị đó. Nhờ vậy mỗi phim ra một dòng
    // là phần điểm cao nhất, không phải trộn cột từ nhiều hàng.
    const items = db
      .prepare(
        `select *, max(diem) as diem_cao,
                (select count(*) from kho_phim k2
                  where k2.goc_khong_dau = kho_phim.goc_khong_dau) as tong_phan
         from kho_phim${dau}
         group by coalesce(goc_khong_dau, slug)
         order by ${sap} limit ? offset ?`,
      )
      .all(...ts, moiTrang, (trang - 1) * moiTrang) as HangKho[]
    const sach = items.filter((h) => !bacBo({ slug: h.slug, ten: h.ten, tenGoc: h.ten_goc ?? undefined }))
    return { items: sach, tongSo, tongTrang: Math.max(1, Math.ceil(tongSo / moiTrang)), trang }
  }

  const tongSo = (db.prepare(`select count(*) as n from kho_phim${dau}`).get(...ts) as { n: number }).n
  const items = (
    db.prepare(`select * from kho_phim${dau} order by ${sap} limit ? offset ?`).all(...ts, moiTrang, (trang - 1) * moiTrang) as HangKho[]
  ).filter((h) => !bacBo({ slug: h.slug, ten: h.ten, tenGoc: h.ten_goc ?? undefined }))
  return { items, tongSo, tongTrang: Math.max(1, Math.ceil(tongSo / moiTrang)), trang }
}

/** Chuyển hàng trong kho về dạng PhimTom để dùng chung thẻ phim. */
export function veTom(h: HangKho): PhimTom {
  return {
    slug: h.slug,
    ten: h.ten,
    tenGoc: h.ten_goc ?? undefined,
    nam: h.nam ?? undefined,
    poster: h.poster ?? undefined,
    anhNgang: h.anh_ngang ?? undefined,
    nguon: 'vsmov',
    chatLuong: h.chat_luong ?? undefined,
    tapHienTai: h.tap_hien_tai ?? undefined,
    loai: h.loai === 'bo' ? 'bo' : 'le',
    diem: h.diem != null ? String(h.diem) : undefined,
    soPhieu: h.so_phieu,
  }
}

/** Thể loại có trong kho kèm số phim — dựng bộ lọc từ dữ liệu thật. */
export function theLoaiTrongKho(): { slug: string; n: number }[] {
  try {
    return db
      .prepare('select slug_the_loai as slug, count(*) as n from kho_the_loai group by slug_the_loai order by n desc')
      .all() as never
  } catch {
    return []
  }
}
