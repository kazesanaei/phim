/**
 * Chạy MỘT lần khi máy chủ Next khởi động — xem
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md
 *
 * Hai việc: bật bộ hẹn giờ tự cập nhật phim mới vào kho đệm (lib/cap-nhat-moi.ts)
 * để kho tươi kể cả khi không ai mở app, và dọn kho khi lưới lọc 18+ đổi.
 */
export async function register() {
  // proxy.ts chạy ở runtime khác; node:sqlite chỉ có ở Node.js
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  // `next build` cũng nạp tệp này trong nhiều tiến trình song song — hẹn giờ ở
  // đó vừa vô ích vừa dễ dính "database is locked" (xem lib/db.ts).
  if (process.env.NEXT_PHASE === 'phase-production-build') return

  const { henGioCapNhat } = await import('./lib/cap-nhat-moi')
  henGioCapNhat()

  // Lưới lọc 18+ đổi phiên bản (hoặc máy mới giải nén kho dựng sẵn) thì dọn kho
  // một lần. Để chậm vài giây cho máy chủ lên trước; unref để không giữ tiến trình.
  setTimeout(async () => {
    try {
      const { donKhoNeuLuoiMoi } = await import('./lib/loc-18')
      const rut = donKhoNeuLuoiMoi()
      if (rut !== null) console.log(`[loc-18] Dọn kho theo lưới mới: rút ${rut} phim bị chặn.`)
    } catch (e) {
      console.warn('[loc-18] Chưa dọn được kho:', e instanceof Error ? e.message : e)
    }
  }, 5_000).unref()
}
