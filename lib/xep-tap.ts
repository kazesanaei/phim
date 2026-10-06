/**
 * Sắp tập theo số tập.
 *
 * Nguồn trả tập KHÔNG theo thứ tự: đo trên Đảo Hải Tặc (1180 tập), vị trí 0 là
 * tập 1156 và thứ tự bị tụt 24 lần. Ai lấy "tập đầu" bằng `tap[0]` hay "tập
 * sau" bằng `tap[i + 1]` là ra sai: nút "Xem ngay" mở tập 1156, hết tập 1178
 * thì tự nhảy về 1127.
 *
 * Chỉ sắp khi MỌI tên tập đều là số. Có tập đặc biệt hay "Full" thì giữ nguyên
 * thứ tự của nguồn — lúc đó nguồn mới là bên biết thứ tự đúng.
 */
export function xepTap<T extends { ten: string }>(ds: T[]): T[] {
  const so = ds.map((t) => Number(t.ten))
  if (!so.every((n) => Number.isFinite(n))) return ds
  return ds
    .map((t, i) => ({ t, n: so[i] }))
    .sort((a, b) => a.n - b.n)
    .map((x) => x.t)
}
