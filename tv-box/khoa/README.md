# Khoá ký APK cho TV box

`debug.keystore` — khoá debug cố định (mật khẩu `android`, alias `androiddebugkey`, như khoá debug
mặc định của Android). Actions đưa thẳng nó cho Gradle (biến `KY` trong
`.github/workflows/ban-tv-box.yml`) khi build app Kho phim và launcher, nên mọi bản build cùng một chữ ký: bản mới cài đè bản cũ (`adb install -r`) được.

Trước đây mỗi lần Actions chạy tự tạo khoá debug mới → bản sau không cài đè được bản trước, phải gỡ
app rồi cài lại — với launcher đang làm màn hình chính thì gỡ ra là box mất Home.

Khoá nằm công khai: ai có nó cũng ký được APK cùng tên gói, nhưng muốn cài lên box vẫn phải có adb
vào box (gỡ lỗi qua Wi-Fi đã ghép nối). Hai app chỉ xin quyền INTERNET (launcher thêm quyền của launcher).

Dấu vân tay SHA-256 của khoá (so với APK: `keytool -printcert -jarfile` không đọc được APK chỉ ký v2, dùng
`apksigner verify --print-certs`):
`87:38:AC:70:64:69:E3:BA:C6:0F:D7:D5:E7:EC:34:08:DE:05:95:83:81:D6:B3:C6:6B:6A:61:E9:8C:41:0E:AA`
