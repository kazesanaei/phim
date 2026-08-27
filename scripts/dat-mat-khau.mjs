/**
 * Đặt / xoá mật khẩu chế độ LAN, và bật/tắt chế độ LAN — chạy trên chính máy chủ.
 *
 * Đây là đường thoát khi quên mật khẩu: giao diện Quản trị nằm SAU cửa xác thực
 * nên không tự cứu được. Chạy được lệnh này nghĩa là đã ngồi trước máy, mà ngồi
 * trước máy thì vốn đã đọc ghi được cả ổ đĩa — nên không có gì để bảo vệ thêm.
 *
 *   node scripts/dat-mat-khau.mjs <mật khẩu>   đặt mật khẩu và BẬT chế độ LAN
 *   node scripts/dat-mat-khau.mjs --xoa        xoá mật khẩu và TẮT chế độ LAN
 *   node scripts/dat-mat-khau.mjs --xem        xem trạng thái hiện tại
 */
import { DatabaseSync } from 'node:sqlite'
import { randomBytes, scryptSync } from 'node:crypto'
import { networkInterfaces } from 'node:os'
import path from 'node:path'

const db = new DatabaseSync(path.join(process.cwd(), 'du-lieu', 'phim.db'))
db.exec('create table if not exists cai_dat (khoa text primary key, gia_tri text)')

const doc = (k, mac = '') =>
  db.prepare('select gia_tri from cai_dat where khoa = ?').get(k)?.gia_tri ?? mac
const ghi = (k, v) =>
  db
    .prepare(
      'insert into cai_dat (khoa, gia_tri) values (?, ?) on conflict(khoa) do update set gia_tri = excluded.gia_tri',
    )
    .run(k, v)

function diaChiLan() {
  const ra = []
  for (const ds of Object.values(networkInterfaces())) {
    for (const m of ds ?? []) {
      if (m.family === 'IPv4' && !m.internal) ra.push(m.address)
    }
  }
  return ra
}

const doiSo = process.argv[2]

if (!doiSo || doiSo === '--xem') {
  const coMk = !!doc('mat_khau_bam')
  console.log('\n  Chế độ LAN : ' + (doc('che_do_lan') === 'bat' ? 'BẬT' : 'tắt'))
  console.log('  Mật khẩu   : ' + (coMk ? 'đã đặt' : 'CHƯA đặt'))
  const ip = diaChiLan()
  if (ip.length) console.log('  Địa chỉ LAN: ' + ip.map((a) => `http://${a}:3000`).join('  '))
  console.log('\n  Đặt mật khẩu: node scripts/dat-mat-khau.mjs <mật khẩu>')
  console.log('  Tắt LAN     : node scripts/dat-mat-khau.mjs --xoa\n')
  process.exit(0)
}

if (doiSo === '--xoa') {
  ghi('mat_khau_bam', '')
  ghi('che_do_lan', '')
  console.log('\n  Đã xoá mật khẩu và TẮT chế độ LAN. App chỉ còn nghe 127.0.0.1.\n')
  process.exit(0)
}

if (doiSo.length < 4) {
  console.error('\n  Mật khẩu quá ngắn (tối thiểu 4 ký tự).\n')
  process.exit(1)
}

const muoi = randomBytes(16).toString('hex')
ghi('mat_khau_bam', muoi + ':' + scryptSync(doiSo, muoi, 64).toString('hex'))
ghi('che_do_lan', 'bat')

console.log('\n  Đã đặt mật khẩu và BẬT chế độ LAN.')
const ip = diaChiLan()
if (ip.length) {
  console.log('\n  Trên TV Box / điện thoại, mở trình duyệt vào:')
  for (const a of ip) console.log('     http://' + a + ':3000')
}
console.log('\n  Khởi động app bằng:  npm run tv    (build + nghe cả LAN)')
console.log('  Laptop PHẢI bật thì link mới sống.\n')
