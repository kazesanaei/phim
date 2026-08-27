# Kho đệm metadata dựng sẵn

`kho-dem-18719-phim.zip` chứa **18.719 phim + 43.608 liên kết thể loại + 79 mục sổ đen 18+**
đã quét sẵn. Giải nén ra một file SQLite ~10,5 MB.

## Dùng để làm gì

Bỏ qua bước quét 45 phút khi cài trên máy mới. Có kho này thì dùng được ngay:

- Sắp xếp theo điểm (xếp hạng có trọng số) hoặc theo năm
- Lọc nhiều thể loại cùng lúc
- Gom các phần của một phim triệt để trên toàn danh mục

Ba thứ đó nguồn phim **không hỗ trợ** — chỉ kho đệm làm được.

## Cách dùng

Làm **trước khi chạy app lần đầu**:

1. Giải nén, được `phim-kho-dem.db`
2. Đổi tên thành `phim.db`
3. Đặt vào thư mục `du-lieu/` ở gốc dự án (tạo thư mục nếu chưa có)
4. `npm run chay`

App tự bổ sung các bảng còn thiếu lúc khởi động, không cần làm gì thêm.

**Đã có dữ liệu rồi thì đừng đè lên** — sẽ mất lịch sử xem, yêu thích và mốc intro.
Trường hợp đó cứ vào Quản trị → Kho đệm bấm quét, kết quả y hệt.

## Trong này KHÔNG có gì

Bản này dựng lại từ đầu, **chỉ chép 3 bảng dữ liệu phim**. Không mang theo:

| Không có | Vì sao quan trọng |
|---|---|
| `cai_dat` | Chứa băm mật khẩu LAN, khoá ký HMAC, API key |
| `xem`, `danh_dau` | Lịch sử xem, yêu thích — dữ liệu riêng tư |
| `nguon_thu_muc` | Đường dẫn ổ cứng, mỗi máy mỗi khác |
| `moc_intro`, `theo_doi`, `tai_ve` | Trạng thái riêng từng máy |

## Lưu ý về git

Đây là dữ liệu **tái tạo được**, cố tình đặt ngoài `du-lieu/`. Nếu sau này cập nhật,
**đừng commit đè nhiều lần** — mỗi bản là ~3,8 MB nằm vĩnh viễn trong lịch sử git.
Cần cập nhật thường xuyên thì dùng GitHub Releases thay vì commit.
