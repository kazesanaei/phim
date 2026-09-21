/**
 * Máy chủ tự dựng: phục vụ CẢ HTTP lẫn HTTPS từ một tiến trình.
 *
 * VÌ SAO KHÔNG DÙNG `next start`: nó chỉ nói HTTP. Trình duyệt trên TV Box tự
 * nâng địa chỉ gõ vào thành `https://` và không tắt được, nên vào là dính
 * ERR_SSL_PROTOCOL_ERROR (đã gặp thật trên Xiaomi Box).
 *
 * Giữ luôn cổng HTTP: cần nó để tải chứng chỉ CA về Box (lúc đó Box chưa tin
 * HTTPS của mình, tải qua HTTPS là bế tắc con gà quả trứng), và để xem trên
 * laptop khỏi phải bấm qua cảnh báo.
 *
 * Theo mẫu custom server ở node_modules/next/dist/docs/01-app/02-guides/custom-server.md.
 */
import { createServer as taoHttp } from 'node:http'
import { createServer as taoHttps } from 'node:https'
import { readFileSync } from 'node:fs'
import next from 'next'
import { baoDamChungChi, diaChiLan } from './scripts/tao-chung-chi.mjs'

const CONG_HTTP = Number(process.env.PORT || 3000)
const CONG_HTTPS = Number(process.env.PORT_HTTPS || 3443)
/**
 * Mặc định chỉ nghe máy này. Thêm `--lan` để mở ra wifi.
 * Dùng cờ chứ không dùng biến môi trường: `HOST=... npm run tv` không chạy được
 * trên Windows, mà đó lại là chỗ script này sống.
 */
const RA_LAN = process.argv.includes('--lan') || process.env.HOST === '0.0.0.0'
const HOST = RA_LAN ? '0.0.0.0' : '127.0.0.1'

/** Đường tải CA. Để ngoài Next nên không dính cửa xác thực — cần vậy, vì phải
 *  tải được CA TRƯỚC khi đăng nhập. Đây là phần công khai của CA, không phải
 *  khoá riêng, nên lộ ra cũng không ai giả mạo được gì. */
const DUONG_CA = '/ca.crt'

const app = next({ dev: false })
const nhan = app.getRequestHandler()

await app.prepare()

let tlsSan = null
if (RA_LAN) {
  try {
    const kq = baoDamChungChi({ im: true })
    tlsSan = {
      key: readFileSync(kq.khoa),
      // Gửi kèm CA: thiếu nó thì máy đã cài CA vẫn không dựng được chuỗi tin cậy.
      cert: Buffer.concat([readFileSync(kq.chungChi), readFileSync(kq.caChungChi)]),
      ca: readFileSync(kq.caChungChi),
    }
  } catch (e) {
    console.log('  Khong dung duoc HTTPS: ' + e.message)
  }
}

function phucVu(req, res) {
  if (tlsSan && req.url && req.url.split('?')[0] === DUONG_CA) {
    // Kiểu MIME này khiến Android nhận ra là chứng chỉ và mở thẳng màn hình cài.
    res.writeHead(200, {
      'Content-Type': 'application/x-x509-ca-cert',
      'Content-Disposition': 'attachment; filename="kho-phim-ca.crt"',
      'Cache-Control': 'no-store',
    })
    res.end(tlsSan.ca)
    return
  }
  nhan(req, res)
}

taoHttp(phucVu).listen(CONG_HTTP, HOST)
console.log(`  http://127.0.0.1:${CONG_HTTP}`)

if (RA_LAN) {
  if (tlsSan) taoHttps({ key: tlsSan.key, cert: tlsSan.cert }, phucVu).listen(CONG_HTTPS, HOST)
  for (const ip of diaChiLan()) {
    console.log(``)
    console.log(`  DIA CHI GO TREN TV:   http://${ip}:${CONG_HTTP}`)
    if (tlsSan) {
      // Giữ đường HTTPS làm lối dự phòng: có trình duyệt TV tự nâng địa chỉ gõ
      // vào thành https rồi báo ERR_SSL_PROTOCOL_ERROR nếu cổng đó không mở.
      console.log(`  (du phong, neu bi ep https):  https://${ip}:${CONG_HTTPS}`)
      console.log(`  (chung chi, neu muon cai):    http://${ip}:${CONG_HTTP}${DUONG_CA}`)
    }
  }
}
