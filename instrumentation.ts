/**
 * Chạy MỘT lần khi máy chủ Next khởi động — xem
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md
 *
 * Việc duy nhất ở đây: bật bộ hẹn giờ tự cập nhật phim mới vào kho đệm
 * (lib/cap-nhat-moi.ts), để kho tươi kể cả khi không ai mở app.
 */
export async function register() {
  // proxy.ts chạy ở runtime khác; node:sqlite chỉ có ở Node.js
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  // `next build` cũng nạp tệp này trong nhiều tiến trình song song — hẹn giờ ở
  // đó vừa vô ích vừa dễ dính "database is locked" (xem lib/db.ts).
  if (process.env.NEXT_PHASE === 'phase-production-build') return

  const { henGioCapNhat } = await import('./lib/cap-nhat-moi')
  henGioCapNhat()
}
