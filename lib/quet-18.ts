/**
 * Quét danh sách 18+ CHẠY NỀN, có tiến độ, và tự quét định kỳ.
 *
 * Trước đây nút "Quét lại sổ đen" chờ trọn một request: ~20 trang danh sách
 * cộng một lượt gọi chi tiết cho mỗi phim (vài trăm phim) — mất vài phút, đóng
 * tab là mất kết quả, và phim 18+ mới lên nguồn chỉ bị bắt khi có người nhớ bấm.
 * Giờ:
 *  - Quét chạy trong tiến trình máy chủ, Quản trị chỉ hỏi tiến độ.
 *  - Mỗi CACH_GIO giờ tự quét một lượt nhẹ: chỉ gọi chi tiết cho phim CHƯA
 *    phân loại, phim cũ đã xét thì thôi.
 *  - Phim mới gặp vào hàng "chờ duyệt" trong Quản trị; chủ máy chốt hiện hay ẩn.
 *
 * Ba bước: lấy danh sách thể loại 18+ của nguồn → phân loại từng phim theo
 * thể loại còn lại (lib/ten-18.ts mucTheoTheLoai) → dọn kho theo lưới tên.
 */
import { db, layCaiDat, datCaiDat } from './db'
import { quetSlug18, layChiTiet } from './nguon-kkphim'
import { themVaoSoDen, phanLoaiSoDen, donKho18 } from './loc-18'

const KHOA_KET_QUA = 'quet_18_ket_qua'
/** Bật/tắt tự quét. Mặc định bật. */
const KHOA_TU_DONG = 'quet_18_tu_dong'

/** Khoảng cách giữa hai lần tự quét. Thể loại 18+ của nguồn ra chậm, một ngày một lần là đủ. */
const CACH_GIO = 24
/** Lần trước lỗi (thường là mất mạng) thì thử lại sớm hơn. */
const THU_LAI_GIO = 3
/** Chờ sau khi máy chủ lên: để tự cập nhật phim mới (chạy ở phút thứ 1) đi trước. */
const CHO_KHOI_DONG_MS = 5 * 60_000
const NHIP_KIEM_MS = 60 * 60_000
/** Vòng quét im lâu hơn thế này coi như đã chết (hot-reload bỏ rơi nó). */
const HAN_NHIP_TIM_MS = 120_000
/** Gọi chi tiết theo nhóm: nhanh mà nguồn không bị dồn. */
const LUONG = 4
const NGHI_MS = 150

export type GiaiDoan18 = 'danh-sach' | 'phan-loai' | 'don-kho'

export type KetQuaQuet18 = {
  /** Số phim trong thể loại 18+ của nguồn. */
  them: number
  /** Trong đó lần đầu gặp — vào hàng chờ duyệt. */
  moi: number
  chan: number
  ganMac: number
  khongXet: number
  /** Số phim rút khỏi kho đệm. */
  don: number
}

export type TienDoQuet18 = {
  dangChay: boolean
  giaiDoan: GiaiDoan18 | null
  daXet: number
  canXet: number
  toanBo: boolean
  tuDong: boolean
  batDauLuc: string | null
  xongLuc: string | null
  ketQua: KetQuaQuet18 | null
  loi: string | null
}

type DangQuet = { nhip: number; dung: boolean; giaiDoan: GiaiDoan18; daXet: number; canXet: number; toanBo: boolean }

const kho = globalThis as unknown as {
  __quet18?: DangQuet
  __henGioQuet18?: ReturnType<typeof setInterval>
}

function docKetQua(): { batDauLuc: string | null; xongLuc: string | null; ketQua: KetQuaQuet18 | null; loi: string | null } {
  try {
    const t = JSON.parse(layCaiDat(KHOA_KET_QUA, '{}')) as Record<string, unknown>
    return {
      batDauLuc: (t.batDauLuc as string) ?? null,
      xongLuc: (t.xongLuc as string) ?? null,
      ketQua: (t.ketQua as KetQuaQuet18) ?? null,
      loi: (t.loi as string) ?? null,
    }
  } catch {
    return { batDauLuc: null, xongLuc: null, ketQua: null, loi: null }
  }
}

function ghiKetQua(t: Record<string, unknown>) {
  datCaiDat(KHOA_KET_QUA, JSON.stringify({ ...docKetQua(), ...t }))
}

function dangQuet(): DangQuet | null {
  const v = kho.__quet18
  return v && Date.now() - v.nhip < HAN_NHIP_TIM_MS ? v : null
}

export function tuQuet18Bat(): boolean {
  return layCaiDat(KHOA_TU_DONG, 'bat') !== 'tat'
}

export function datTuQuet18(bat: boolean) {
  datCaiDat(KHOA_TU_DONG, bat ? 'bat' : 'tat')
}

export function tienDoQuet18(): TienDoQuet18 {
  const v = dangQuet()
  return {
    dangChay: !!v,
    giaiDoan: v?.giaiDoan ?? null,
    daXet: v?.daXet ?? 0,
    canXet: v?.canXet ?? 0,
    toanBo: v?.toanBo ?? false,
    tuDong: tuQuet18Bat(),
    ...docKetQua(),
  }
}

export function dungQuet18() {
  if (kho.__quet18) kho.__quet18.dung = true
}

/**
 * Bắt đầu quét nền. Đang quét thì thôi (trả false).
 * `toanBo`: phân loại lại MỌI phim của thể loại 18+, kể cả phim đã xét — dùng
 * sau khi đổi luật phân loại. Mặc định chỉ xét phim chưa phân loại.
 */
export function batDauQuet18(toanBo = false): boolean {
  if (dangQuet()) return false
  const v: DangQuet = { nhip: Date.now(), dung: false, giaiDoan: 'danh-sach', daXet: 0, canXet: 0, toanBo }
  kho.__quet18 = v
  ghiKetQua({ batDauLuc: new Date().toISOString(), loi: null })

  void (async () => {
    try {
      const ds = await quetSlug18((trang, tong) => {
        v.nhip = Date.now()
        v.daXet = trang
        v.canXet = tong
      })
      if (v.dung) throw new Error('Đã dừng giữa chừng')
      const moi = themVaoSoDen(ds)

      // Chỉ gọi chi tiết cho phim cần xét: chưa phân loại (the_loai trống), hoặc tất cả nếu quét lại toàn bộ
      const chuaXet = new Set(
        (db.prepare('select slug from chan_18 where the_loai is null').all() as { slug: string }[]).map((r) => r.slug),
      )
      const canXet = toanBo ? ds : ds.filter((p) => chuaXet.has(p.slug))
      v.giaiDoan = 'phan-loai'
      v.daXet = 0
      v.canXet = canXet.length

      let chan = 0
      let ganMac = 0
      let khongXet = 0
      for (let i = 0; i < canXet.length; i += LUONG) {
        if (v.dung) throw new Error('Đã dừng giữa chừng')
        const nhom = canXet.slice(i, i + LUONG)
        const ct = await Promise.all(nhom.map((p) => layChiTiet(p.slug).catch(() => null)))
        nhom.forEach((p, j) => {
          const c = ct[j]
          if (!c) {
            khongXet++ // không lấy được chi tiết thì giữ mức cũ (mặc định chặn), lần sau xét lại
            return
          }
          const muc = phanLoaiSoDen(p.slug, c.theLoai, {
            quocGia: c.quocGia,
            soPhieu: c.soPhieu,
            ten: c.ten,
            tenGoc: c.tenGoc,
            poster: c.poster,
            nam: c.nam,
          })
          if (muc === 'chan') chan++
          else ganMac++
        })
        v.daXet = Math.min(canXet.length, i + LUONG)
        v.nhip = Date.now()
        await new Promise((r) => setTimeout(r, NGHI_MS))
      }

      // Quét xong thì dọn luôn kho: phim lọt lưới CŨ vẫn còn nằm đó.
      v.giaiDoan = 'don-kho'
      v.nhip = Date.now()
      const don = donKho18()

      ghiKetQua({
        xongLuc: new Date().toISOString(),
        ketQua: { them: ds.length, moi, chan, ganMac, khongXet, don } satisfies KetQuaQuet18,
        loi: null,
      })
      if (moi) console.log(`[quet-18] ${moi} phim 18+ mới, chờ duyệt trong Quản trị.`)
    } catch (e) {
      ghiKetQua({ loi: e instanceof Error ? e.message : String(e) })
      console.warn('[quet-18]', e instanceof Error ? e.message : e)
    } finally {
      if (kho.__quet18 === v) kho.__quet18 = undefined
    }
  })()
  return true
}

/** Tới lúc tự quét chưa: lần trước xong quá CACH_GIO giờ, hoặc lỗi quá THU_LAI_GIO giờ. */
function denLucTuQuet(): boolean {
  if (!tuQuet18Bat() || dangQuet()) return false
  const { batDauLuc, xongLuc, loi } = docKetQua()
  const moc = loi ? batDauLuc : xongLuc
  if (!moc) return true
  return Date.now() - Date.parse(moc) >= (loi ? THU_LAI_GIO : CACH_GIO) * 3_600_000
}

/**
 * Bộ hẹn giờ tự quét. Gọi MỘT lần lúc khởi động (instrumentation.ts); gọi lại
 * khi hot-reload thì bỏ qua. `unref()` để không giữ tiến trình sống.
 */
export function henGioQuet18(): void {
  if (kho.__henGioQuet18) return
  const kiem = () => {
    try {
      if (denLucTuQuet()) batDauQuet18(false)
    } catch (e) {
      console.warn('[quet-18]', e instanceof Error ? e.message : e)
    }
  }
  setTimeout(kiem, CHO_KHOI_DONG_MS).unref()
  kho.__henGioQuet18 = setInterval(kiem, NHIP_KIEM_MS)
  kho.__henGioQuet18.unref()
}
