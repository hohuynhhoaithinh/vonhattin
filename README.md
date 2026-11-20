# Thiệp mời tốt nghiệp – Võ Nhật Tín

Web tĩnh: mở bằng "tin nhắn mới", nút **Không** chạy trốn, bấm **Có** thì điền tên + email.
Email được gửi qua **Brevo** bằng Vercel Function: một mail báo cho bạn, một mail cảm ơn cho người điền.

## 1. Chạy thử trên máy

Phải mở qua http (không mở thẳng file `index.html`). Chọn một cách:

```bash
npm start                              # cần Node, dùng "serve"
# hoặc
cd public && python3 -m http.server 3000
```

Mở http://localhost:3000. Thử link cá nhân hóa: http://localhost:3000/?to=Minh

Nếu chưa cấu hình biến môi trường Brevo trên Vercel, form sẽ báo lỗi cấu hình thay vì giả
vờ gửi thành công.

## 2. Sửa thông tin buổi lễ

Mở `public/event.json`: tên bạn (`hostName`), giờ bắt đầu/kết thúc (`startISO`, `endISO`, múi giờ +07:00),
địa điểm, địa chỉ, link Google Maps, trang phục, lời nhắn. Muốn đổi ảnh thì thay `public/assets/photo.png`.

Số điện thoại hiện dưới địa chỉ lấy từ trường `phone` (để trống thì ẩn đi). Bấm vào số trên điện thoại sẽ mở bàn phím gọi.

### Hiệu ứng khi bấm "Có"

Sóng biển quét từ dưới lên đổi cả trang từ bơ vàng sang xanh biển, đồng thời bong bóng bay nhanh gấp 8 lần.
Muốn đổi màu biển thì sửa các biến `--sea`, `--sea-deep`, `--sea-light`, `--sea-paper`, `--sea-ink`, `--sea-mid` ở đầu `public/style.css`.
Tốc độ bong bóng là `TOP` trong hàm `blowBubbles()`, độ dài sóng là `DUR` trong hàm `seaWave()` (`public/app.js`).

### Gửi xác nhận bằng cách ném bóng rổ

Sau khi điền tên + email và bấm **Xác nhận**, thông tin được "đóng gói" vào phong bì, rồi hiện sân bóng.
Khách kéo quả bóng xuống, thả tay để ném (có chấm gợi ý quỹ đạo). **Bóng vào rổ thì mới gọi `/api/send-rsvp`.**
Ném trượt thì bóng quay lại để ném tiếp; nút **Ném giúp mình** tự ném một cú trúng rổ cho ai không muốn chơi.
Gửi lỗi (mất mạng...) thì hiện nút **Gửi lại**, không phải ném lại.
Chỉnh độ khó trong hàm `createCourt()` (`public/app.js`): `RIM_R` (độ rộng vành rổ), `KX`/`KY` (lực ném), `G` (trọng lực).

### Bảng màu

Latte `#E8D5BC`, caramel `#C79F7C`, nâu espresso `#2B1B13` (màu tóc), vành rổ/bóng `#C0602B`; sau khi bấm Có, sóng đổi sang xanh sage.
Sửa ở các biến đầu `public/style.css`. Hoa văn 4 góc trong email đã đổi sang nâu đất (`public/assets/corner-*.png`).

### Nhạc nền

Bỏ file nhạc của bạn vào `public/assets/music.mp3`. Nhạc tự phát khi khách chạm vào "tin nhắn mới" (trình duyệt chỉ cho phát nhạc sau một thao tác của người dùng),
và có nút tròn góc dưới bên phải để tắt/bật. Chưa có file `music.mp3` thì nút nhạc tự ẩn. Muốn đổi tên file, sửa `MUSIC_SRC` trong `public/app.js`.
Nên dùng file mp3 dưới khoảng 3 MB cho tải nhanh trên 4G, và dùng nhạc bạn có quyền sử dụng nếu đăng link công khai.

## 3. Bật gửi email thật bằng Brevo trên Vercel

1. Tạo tài khoản tại https://app.brevo.com và xác minh email người gửi trong **Senders & IP**.
2. Vào **SMTP & API → API Keys**, tạo một API key.
3. Trong Vercel, vào **Project → Settings → Environment Variables** và thêm:
   - `BREVO_API_KEY`: API key vừa tạo
   - `BREVO_SENDER_EMAIL`: email đã xác minh trong Brevo
   - `BREVO_SENDER_NAME`: tên người gửi, ví dụ `Thiệp mời`
   - `OWNER_EMAIL`: email nhận thông báo RSVP
   - `PUBLIC_SITE_URL`: URL HTTPS của website để email tải ảnh, ví dụ `https://ten-du-an.vercel.app`
4. Redeploy project trên Vercel. API key chỉ nằm ở server, không đặt vào `public/`.

Mỗi lượt xác nhận sẽ gửi 2 email qua Brevo: một email báo cho chủ thiệp và một email xác nhận cho khách.
Ảnh `public/assets/photo.png` sẽ được chèn vào email khi `PUBLIC_SITE_URL` đã được cấu hình.

## 4. Link riêng cho từng người

Thêm `?to=Tên` vào cuối link, ví dụ `https://ten-mien.netlify.app/?to=Linh`
sẽ hiện "Gửi Linh," và tự điền sẵn tên vào form.

## 5. Đưa lên mạng (khi sẵn sàng)

Chỉ cần đăng thư mục `public/` như một web tĩnh:
- **Netlify:** vào app.netlify.com/drop rồi kéo thả thư mục `public`. Xong có link ngay.
- **Vercel:** Framework Preset chọn Other, Output Directory đặt là `public`.
- **GitHub Pages:** đưa nội dung `public/` lên repo rồi bật Pages.

Sau khi có link thật, gửi thử vào Zalo/Messenger để xem ảnh xem trước, và sửa `og:url` trong `public/index.html` nếu muốn.

## Cấu trúc

```
public/              toàn bộ web (index.html, style.css, app.js, event.json, assets/)
api/send-rsvp.js     Vercel Function gửi hai email qua Brevo
```
