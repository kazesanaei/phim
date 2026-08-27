/**
 * Hàng đợi tải phim về xem offline.
 *
 * Cách làm: ffmpeg đọc thẳng playlist HLS (chạy phía máy chủ nên không dính
 * CORS), remux sang MP4 bằng -c copy nên không mã hoá lại — nhanh và không mất
 * chất lượng. Phụ đề tải trước, chuẩn hoá mốc thời gian rồi nhúng vào file
 * dạng mov_text.
 *
 * Trạng thái ở SQLite, tiến trình đang chạy giữ trong RAM. Mất điện giữa chừng
 * thì các dòng 'dang' được đưa về 'loi' lúc khởi động lại.
 */
import { mkdir, writeFile, rm, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { db, layCaiDat, thuMucNguon } from './db'
import { tenTepAnToan } from './an-toan'
import { giaiMaEmbed } from './nguon-phat'
import { srtSangVtt } from './phu-de'
import { taiHlsSangMp4, UA, type ViecTai, type PhuDeNhung } from './ffmpeg'

export type HangTaiVe = {
  id: number
  phim_slug: string
  tap_slug: string
  ten_hien: string
  embed: string
  poster: string | null
  trang_thai: 'cho' | 'dang' | 'xong' | 'loi' | 'huy'
  phan_tram: number
  duong_dan_ra: string | null
  loi: string | null
  tao_luc: string
}

const dangChay = new Map<number, ViecTai>()

const kho = globalThis as unknown as { __taiVeDaDon?: boolean }

/** Lần đầu chạm tới module sau khi khởi động lại: dọn các việc treo lơ lửng. */
function donKhiKhoiDong() {
  if (kho.__taiVeDaDon) return
  kho.__taiVeDaDon = true
  db.prepare("update tai_ve set trang_thai = 'loi', loi = 'Bị ngắt do khởi động lại' where trang_thai = 'dang'").run()
}

export function thuMucTai(): string {
  const danh = thuMucNguon(false).find((t) => t.la_thu_muc_tai)
  if (!danh) throw new Error('Chưa đặt thư mục tải về. Vào Quản trị > Thư mục nguồn để chọn.')
  return danh.duong_dan
}

export function danhSachTai(): HangTaiVe[] {
  donKhiKhoiDong()
  return db.prepare('select * from tai_ve order by id desc').all() as HangTaiVe[]
}

export function demDangTai(): number {
  return (db.prepare("select count(*) as n from tai_ve where trang_thai = 'dang'").get() as { n: number }).n
}

export type YeuCauTai = { phimSlug: string; tapSlug: string; tenHien: string; embed: string; poster?: string }

export function themVaoHangDoi(ds: YeuCauTai[]): number {
  donKhiKhoiDong()
  const cau = db.prepare(
    `insert into tai_ve (phim_slug, tap_slug, ten_hien, embed, poster, trang_thai)
     values (?, ?, ?, ?, ?, 'cho')
     on conflict(phim_slug, tap_slug) do update set
       trang_thai = case when tai_ve.trang_thai in ('loi', 'huy') then 'cho' else tai_ve.trang_thai end,
       loi = null`,
  )
  let them = 0
  for (const y of ds) {
    if (!y.embed || !y.tapSlug) continue
    cau.run(y.phimSlug, y.tapSlug, y.tenHien, y.embed, y.poster || null)
    them++
  }
  chayTiep()
  return them
}

export function huyTai(id: number) {
  const viec = dangChay.get(id)
  if (viec) {
    viec.huy()
    dangChay.delete(id)
  }
  const h = db.prepare('select duong_dan_ra, trang_thai from tai_ve where id = ?').get(id) as
    | { duong_dan_ra: string | null; trang_thai: string }
    | undefined
  db.prepare("update tai_ve set trang_thai = 'huy', phan_tram = 0 where id = ?").run(id)
  // File dở dang không xem được, xoá luôn cho gọn ổ đĩa.
  if (h?.duong_dan_ra && h.trang_thai !== 'xong' && existsSync(h.duong_dan_ra)) {
    unlink(h.duong_dan_ra).catch(() => {})
  }
  chayTiep()
}

export function xoaKhoiDanhSach(id: number, xoaCaFile = false) {
  huyTai(id)
  if (xoaCaFile) {
    const h = db.prepare('select duong_dan_ra from tai_ve where id = ?').get(id) as
      | { duong_dan_ra: string | null }
      | undefined
    if (h?.duong_dan_ra && existsSync(h.duong_dan_ra)) unlink(h.duong_dan_ra).catch(() => {})
  }
  db.prepare('delete from tai_ve where id = ?').run(id)
}

async function taiMotViec(h: HangTaiVe) {
  const goc = thuMucTai()
  await mkdir(goc, { recursive: true })

  const nguon = await giaiMaEmbed(h.embed)

  // Phụ đề: tải về file tạm và LUÔN chuẩn hoá mốc thời gian. Nguồn gắn nhãn
  // WEBVTT nhưng dùng dấu phẩy kiểu SRT — để nguyên thì ffmpeg nhúng ra phụ đề rỗng.
  const thuMucTam = await mkdtempAnToan()
  const phuDe: PhuDeNhung[] = []
  for (const [i, p] of nguon.phuDe.entries()) {
    try {
      const r = await fetch(p.url, { headers: { 'user-agent': UA, referer: 'https://vsmov.com/' } })
      if (!r.ok) continue
      const tep = path.join(thuMucTam, `sub_${i}_${p.ma}.vtt`)
      await writeFile(tep, srtSangVtt(await r.text()), 'utf8')
      phuDe.push({ tep, ma: p.ma, nhan: p.nhan })
    } catch {
      // thiếu một track phụ đề không đáng để hỏng cả lượt tải
    }
  }

  // Giải mã nguồn + tải phụ đề mất vài giây; người dùng có thể đã bấm huỷ trong
  // khoảng đó, khi `huy` còn là hàm rỗng. Kiểm lại trước khi spawn ffmpeg.
  const bayGio = db.prepare('select trang_thai from tai_ve where id = ?').get(h.id) as { trang_thai: string } | undefined
  if (!bayGio || bayGio.trang_thai === 'huy') {
    await rm(thuMucTam, { recursive: true, force: true }).catch(() => {})
    return
  }

  const raFile = path.join(goc, tenTepAnToan(h.ten_hien) + '.mp4')
  db.prepare("update tai_ve set trang_thai = 'dang', phan_tram = 0, duong_dan_ra = ?, loi = null where id = ?").run(
    raFile,
    h.id,
  )

  let luuLan = 0
  const viec = taiHlsSangMp4({
    m3u8: nguon.m3u8,
    phuDe,
    raFile,
    onTienDo: (pt) => {
      // Ghi DB tối đa mỗi 2 giây, đừng để ffmpeg làm nghẽn ổ đĩa vì cập nhật.
      const gio = Date.now()
      if (gio - luuLan < 2000) return
      luuLan = gio
      db.prepare('update tai_ve set phan_tram = ? where id = ?').run(pt, h.id)
    },
  })
  dangChay.set(h.id, viec)

  try {
    await viec.xong
    db.prepare("update tai_ve set trang_thai = 'xong', phan_tram = 100 where id = ?").run(h.id)
  } finally {
    dangChay.delete(h.id)
    await rm(thuMucTam, { recursive: true, force: true }).catch(() => {})
  }
}

async function mkdtempAnToan(): Promise<string> {
  const d = path.join(os.tmpdir(), 'phim-sub-' + Date.now() + '-' + Math.floor(Math.random() * 1e6))
  await mkdir(d, { recursive: true })
  return d
}

/** Lấy việc kế tiếp trong hàng đợi nếu chưa chạm trần số việc chạy song song. */
export function chayTiep() {
  donKhiKhoiDong()
  const tran = Math.max(1, Math.min(3, Number(layCaiDat('so_viec_tai', '1')) || 1))
  if (dangChay.size >= tran) return

  const ke = db.prepare("select * from tai_ve where trang_thai = 'cho' order by id limit 1").get() as
    | HangTaiVe
    | undefined
  if (!ke) return

  // Chiếm chỗ ngay để lượt gọi chayTiep() kế tiếp không cướp cùng một việc.
  db.prepare("update tai_ve set trang_thai = 'dang' where id = ?").run(ke.id)
  dangChay.set(ke.id, { huy: () => {}, xong: Promise.resolve() })

  taiMotViec(ke)
    .catch((e: unknown) => {
      const tin = e instanceof Error ? e.message : String(e)
      db.prepare("update tai_ve set trang_thai = 'loi', loi = ? where id = ?").run(tin.slice(0, 500), ke.id)
    })
    .finally(() => {
      dangChay.delete(ke.id)
      chayTiep()
    })
}
