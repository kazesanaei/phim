/**
 * Tìm phim theo câu thoại (E2): "câu đó nằm ở phim nào, phút thứ mấy".
 *
 * Chỉ có với phim TRONG MÁY có tệp phụ đề .srt/.vtt (bảng phu_de). Phim nguồn
 * gần như toàn Vietsub cứng in vào hình — không có chữ nào để mà tìm.
 *
 * Chỉ mục FTS5 bỏ dấu (`remove_diacritics 2`) nên gõ "anh yeu em" vẫn khớp
 * "Anh yêu em". Dựng dần: mỗi lần tìm thì đọc nốt các tệp phụ đề mới quét vào,
 * tệp nào đã đọc thì ghi vào cau_thoai_da để khỏi đọc lại.
 */
import { readFileSync } from 'node:fs'
import { db } from './db'
import { srtSangVtt, docCue, boD, type Cue } from './phu-de'
import { mucDo18 } from './loc-18'

function docTep(duong: string): string {
  const b = readFileSync(duong)
  // Phụ đề Windows cũ hay lưu UTF-16 có BOM; đọc như UTF-8 là ra toàn ký tự rác.
  if (b[0] === 0xff && b[1] === 0xfe) return b.toString('utf16le')
  return b.toString('utf8')
}

function lapChiMuc() {
  db.exec('delete from cau_thoai where phu_de_id not in (select id from phu_de)')
  db.exec('delete from cau_thoai_da where phu_de_id not in (select id from phu_de)')
  const moi = db
    .prepare('select id, duong_dan from phu_de where id not in (select phu_de_id from cau_thoai_da)')
    .all() as { id: number; duong_dan: string }[]
  const them = db.prepare('insert into cau_thoai (tim, chu, phu_de_id, giay) values (?, ?, ?, ?)')
  const xong = db.prepare('insert or ignore into cau_thoai_da (phu_de_id) values (?)')
  for (const p of moi) {
    let cue: Cue[] = []
    try {
      cue = docCue(srtSangVtt(docTep(p.duong_dan)))
    } catch {
      // Tệp đã bị dời/xoá: đánh dấu xong luôn, quét lại thư mục sẽ cho id mới.
    }
    db.exec('begin')
    try {
      for (const c of cue) them.run(boD(c.chu), c.chu, p.id, c.giay)
      xong.run(p.id)
      db.exec('commit')
    } catch {
      db.exec('rollback')
    }
  }
}

export type KetQuaThoai = { chu: string; giay: number; soTap: number; nhieuTap: number; slug: string; ten: string; poster: string | null }

export function timCauThoai(q: string, gioiHan = 12): KetQuaThoai[] {
  const tu = boD(q).replace(/["*^:()]/g, ' ').trim()
  // Một hai chữ thì khớp cả nghìn câu, chẳng giúp ai tìm ra phim.
  if (tu.split(/\s+/).length < 2 || tu.length < 5) return []
  try {
    lapChiMuc()
    const ds = db
      .prepare(
        `select c.chu, c.giay, t.so_tap as soTap, ph.slug, ph.ten, ph.poster,
                (select count(*) from tap t2 where t2.phim_id = ph.id) as nhieuTap
         from cau_thoai c
         join phu_de p on p.id = c.phu_de_id
         join tap t on t.id = p.tap_id
         join phim ph on ph.id = t.phim_id
         where cau_thoai match ? order by rank limit ?`,
      )
      // Ngoặc kép = cụm từ: các chữ phải đứng liền nhau đúng thứ tự.
      .all('"' + tu + '"', gioiHan * 2) as KetQuaThoai[]
    // Chặn 18+ tuyệt đối, kể cả phim chỉ bị gắn mác.
    return ds.filter((r) => !mucDo18({ slug: r.slug, ten: r.ten })).slice(0, gioiHan)
  } catch {
    return []
  }
}
