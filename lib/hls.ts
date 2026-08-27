/**
 * Hai hàm thuần về định dạng HLS. Cố ý KHÔNG phụ thuộc gì để bộ kiểm
 * (scripts/kiem-nguon.mjs) nạp thẳng được bằng Node, không kéo theo SQLite.
 */

/**
 * Segment của nguồn này bị phủ một header PNG THẬT ở đầu (khoảng 500 byte) để
 * nguỵ trang thành ảnh. hls.js trong trình duyệt tự dò byte đồng bộ nên không
 * hề hấn, nhưng ffmpeg nhận ra PNG rồi bỏ cuộc với "Invalid data found".
 *
 * Tìm điểm bắt đầu thật của luồng MPEG-TS: byte 0x47 lặp đều mỗi 188 byte.
 * Không thấy thì trả nguyên khối (segment có thể vốn đã sạch).
 */
export function bocVoTS(b: Buffer): Buffer {
  if (b.length > 376 && b[0] === 0x47 && b[188] === 0x47) return b
  const tran = Math.min(b.length - 376, 8192)
  for (let i = 0; i < tran; i++) {
    if (b[i] === 0x47 && b[i + 188] === 0x47 && b[i + 376] === 0x47) {
      return i === 0 ? b : b.subarray(i)
    }
  }
  return b
}

/** Lấy danh sách URL segment từ playlist, giải tương đối theo địa chỉ playlist. */
export function docSegment(noiDung: string, goc: string): string[] {
  return noiDung
    .split(/\r?\n/)
    .map((d) => d.trim())
    .filter((d) => d && !d.startsWith('#'))
    .map((d) => new URL(d, goc).href)
}
