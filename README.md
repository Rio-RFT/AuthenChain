# AuthentiFi · Astryx

Hệ thống định danh sản phẩm và xác thực chống hàng giả. Astryx UI là giao diện mới cho cổng nhà sản xuất, người mua và luồng bàn giao quyền sở hữu.

## Kiến trúc

- **Ethereum / Ganache:** lưu SHA-256 `bytes32`, trạng thái kích hoạt, bộ đếm quét, thời gian kích hoạt và ví sở hữu.
- **MySQL:** lưu metadata off-chain trong `PRODUCTS`, lịch sử chủ sở hữu trong `OWNERSHIP_LOGS`, và `SCAN_LOGS` gồm mã sản phẩm, thời gian, IP, vị trí cùng cờ bất thường.
- **Express:** phát hành mã, xác thực QR, ghi scan log và điều phối handshake bàn giao.
- **Astryx:** trang tổng quan, cổng phát hành, cổng quét camera và bàn giao hai bên.

## Chạy local

1. Cài dependencies bằng `npm install` và tạo file `.env` dựa trên `.env.example`.
2. Khởi chạy Ganache tại `http://127.0.0.1:7545` với tài khoản có ETH.
3. Tạo database và bảng nhật ký: `mysql -u root -p < database/scan_logs.sql`.
4. Biên dịch và deploy hợp đồng:

   ```sh
   npm run compile
   npm run deploy
   ```

   Deploy ghi địa chỉ vào `contract-address.json` (file local, không commit). Có thể dùng `CONTRACT_ADDRESS` trong `.env` để ghi đè.

5. Chạy `npm start`, mở `http://localhost:8080`.

### Nạp tư liệu sản phẩm demo

Sau khi tạo database bằng schema ở trên, chạy `npm run seed:demo` để upsert 100 sản phẩm thuộc 12 thương hiệu. Seeder sinh hash, serial, batch, UID, salt và thời gian cố định để có thể chạy lặp lại mà không nhân bản dữ liệu. Để chọn số lượng khác, chạy `node scripts/seed-demo-products.js --count=500` (tối đa 10.000).

Xem trước dữ liệu mà không cần kết nối service: `node scripts/seed-demo-products.js --count=100 --preview`.

Mặc định seeder yêu cầu Ganache đang chạy và hợp đồng đã deploy; mỗi hash được tạo và kích hoạt trên chain để dùng được qua `/api/verify`. Dùng `node scripts/seed-demo-products.js --database-only` nếu chỉ muốn nạp dữ liệu MySQL để thử truy vấn. Các mã ở chế độ này chưa xác thực được qua API cho đến khi được đăng ký on-chain.

Camera cần quyền truy cập và HTTPS hoặc localhost. Nếu camera không khả dụng, cổng xác thực vẫn nhận mã dán thủ công. MySQL không bắt buộc để server khởi động; khi chưa kết nối, scan log tạm giữ trong bộ nhớ và mất khi tiến trình dừng.

## Luồng sản phẩm

1. Nhà sản xuất nhập thương hiệu, model, serial và dữ liệu lô. Server sinh salt ngẫu nhiên 128-bit, timestamp ISO và hash SHA-256, sau đó tạo bản ghi trên chain.
2. Nhà sản xuất kích hoạt sản phẩm. QR chỉ chứa URL xác thực cùng hash.
3. `/api/verify` kiểm tra hash và trạng thái kích hoạt, tăng `scanCount` on-chain, ghi IP/vị trí vào `SCAN_LOGS`. Lần đầu là thẻ xanh; lần quét tiếp theo hoặc mã không tồn tại là thẻ đỏ.
4. `/api/ownership/handshake` tạo session tối đa 600 giây. Seller và buyer có mã xác nhận riêng; chỉ khi cả hai xác nhận trong hạn mới gọi `changeOwner`.

## API

- `POST /QRCodeForManufacturer` — JSON: `brand`, `model`, `serial`, `batch`, `uid`, `description`, `manufacturerName`, `manufacturerLocation`.
- `POST /api/products/:hash/activate` — kích hoạt sản phẩm đã phát hành.
- `POST /api/verify` — JSON: `codeHash` (hoặc `code`) và tùy chọn `location: { latitude, longitude }`.
- `POST /api/ownership/handshake` — JSON: `codeHash`, `newOwner`, tùy chọn `ttlSeconds` (giới hạn 600).
- `POST /api/ownership/handshake/:token/confirm` — JSON: `party: "seller" | "buyer"`, `participantToken` tương ứng.
- `GET /health` — tình trạng kết nối chain/MySQL.

Metadata chi tiết và salt được giữ off-chain; blockchain chỉ lưu hash đại diện cùng trạng thái, scan count và ví sở hữu. Session handshake hiện tồn tại trong bộ nhớ tiến trình.

## Kịch bản nghiệm thu

Với Ganache, MySQL và server đang chạy:

1. Tạo sản phẩm từ cổng nhà sản xuất; response phải có hash 64 ký tự hex và giao dịch đăng ký thành công.
2. Kích hoạt sản phẩm; đọc `getCode(hash)` xác nhận `isVerified = true`.
3. Xác thực lần đầu; API trả `card: "green"`, `scanCount: 1`; kiểm tra có một dòng `SCAN_LOGS`.
4. Quét lại hash; API trả `card: "red"`, `scanCount > 1`, `anomaly_flag = 1`.
5. Xác thực hash hợp lệ định dạng nhưng không có trên chain; API trả `valid: false`, `card: "red"`, HTTP 404.
6. Tạo handshake; hết 600 giây rồi xác nhận; API trả HTTP 410 và owner cũ không đổi. Xác nhận cả hai bên trước hạn thì owner mới được ghi lên chain.
