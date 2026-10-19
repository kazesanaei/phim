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
import { mkdirSync } from 'node:fs'

// Máy mới chưa chạy app lần nào thì chưa có du-lieu/ — tạo luôn, không thì SQLite báo "unable to open"
mkdirSync(path.join(process.cwd(), 'du-lieu'), { recursive: true })
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

// Mã thoát 0 nếu cửa mật khẩu đang bật, 1 nếu chưa — cho script .cmd kiểm trước khi chạy.
if (doiSo === '--kiem') {
  process.exit(doc('che_do_lan') === 'bat' && doc('mat_khau_bam') ? 0 : 1)
}

/**
 * Hỏi mật khẩu ngay trong cửa sổ, KHÔNG hiện chữ khi gõ. Thay cho việc gõ mật
 * khẩu thẳng trên dòng lệnh: ở đó ký tự như & | ^ % làm vỡ lệnh cmd, và mật khẩu
 * hiện rõ trên màn hình lẫn nằm lại trong lịch sử lệnh.
 */
if (doiSo === '--hoi') {
  // Phần gõ/dán dư sau dấu xuống dòng giữ lại cho câu hỏi sau: dán hai dòng một
  // lần thì cả hai tới trong CÙNG một lần đọc, vứt đi là câu hỏi thứ hai treo mãi.
  let du = ''
  const doc1Dong = (cau) =>
    new Promise((ok) => {
      process.stdout.write(cau)
      const vao = process.stdin
      let chu = ''
      const xong = (conLai) => {
        du = conLai
        if (vao.isTTY) vao.setRawMode(false)
        vao.pause()
        vao.off('data', nghe)
        process.stdout.write('\n')
        ok(chu)
      }
      const nghe = (k) => {
        for (let i = 0; i < k.length; i++) {
          const c = k[i]
          if (c === '\r' || c === '\n') {
            // \r\n của Windows: nuốt luôn \n đi kèm
            return xong(k.slice(c === '\r' && k[i + 1] === '\n' ? i + 2 : i + 1))
          }
          if (c === '\u0003') process.exit(1) // Ctrl+C
          if (c === '\u0008' || c === '\u007f') chu = chu.slice(0, -1)
          else chu += c
        }
      }
      vao.on('data', nghe)
      if (vao.isTTY) vao.setRawMode(true)
      vao.setEncoding('utf8')
      if (du) nghe(du)
      if (vao.listenerCount('data')) vao.resume()
    })
  const mk = await doc1Dong('  Nhập mật khẩu mới (ít nhất 4 ký tự, không hiện khi gõ): ')
  if (mk.length < 4) {
    console.error('\n  Mật khẩu quá ngắn (tối thiểu 4 ký tự).\n')
    process.exit(1)
  }
  if ((await doc1Dong('  Nhập lại cho chắc: ')) !== mk) {
    console.error('\n  Hai lần nhập không khớp. Chạy lại để thử lần nữa.\n')
    process.exit(1)
  }
  const muoi = randomBytes(16).toString('hex')
  ghi('mat_khau_bam', muoi + ':' + scryptSync(mk, muoi, 64).toString('hex'))
  // Xoay khoá ký như datMatKhau() trong lib/xac-thuc.ts: mọi vé đăng nhập cũ chết ngay
  ghi('khoa_ky', randomBytes(32).toString('hex'))
  ghi('che_do_lan', 'bat')
  console.log('\n  Đã đặt mật khẩu. Mọi máy (kể cả máy này) đăng nhập một lần là nhớ 1 năm.\n')
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
