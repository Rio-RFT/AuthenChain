# Cài đặt AuthentiFi · Astryx

## Yêu cầu

- Node.js và npm
- Ganache local qua JSON-RPC tại `127.0.0.1:7545`
- MySQL (tùy chọn khi phát triển UI; cần bật để lưu nhật ký scan bền vững)

## Khởi chạy

```sh
npm install
```

Tạo `.env` từ `.env.example`. Khởi động Ganache, sau đó compile và deploy hợp đồng:

```sh
npm run compile
npm run deploy
```

Deploy sẽ lưu địa chỉ mới vào `contract-address.json`; server đọc file này khi khởi động. Có thể thiết lập `CONTRACT_ADDRESS` và `BLOCKCHAIN_RPC_URL` trong `.env` để cấu hình riêng.

Khởi tạo MySQL database và bảng `SCAN_LOGS`:

```sh
mysql -u root -p < database/scan_logs.sql
```

Nạp 100 sản phẩm demo và đăng ký/kích hoạt hash trên Ganache:

```sh
npm run seed:demo
```

Có thể chọn số lượng như `node scripts/seed-demo-products.js --count=500`. Nếu chỉ thử dữ liệu MySQL, bỏ yêu cầu Ganache bằng `node scripts/seed-demo-products.js --database-only`; các sản phẩm dạng này chưa xác thực được trên giao diện cho tới khi đăng ký on-chain.

Cuối cùng:

```sh
npm start
```

Mở `http://localhost:8080`. Camera cần quyền trình duyệt và chạy trên HTTPS hoặc localhost. Nếu MySQL chưa kết nối, server vẫn phục vụ giao diện và tạm giữ nhật ký trong bộ nhớ của tiến trình.

## Kiểm tra nghiệm thu

1. Tạo sản phẩm tại `/createCodes`, kiểm tra hash SHA-256 và giao dịch đăng ký.
2. Kích hoạt sản phẩm; trạng thái trên `getCode(hash)` phải thành `true`.
3. Quét lần đầu tại `/verify`: API trả thẻ xanh, `scanCount = 1`, database ghi một dòng.
4. Quét lại: API trả thẻ đỏ, `scanCount > 1`, `anomaly_flag = 1`.
5. Quét hash hợp lệ định dạng nhưng không có trên chain: API trả thẻ đỏ và HTTP 404.
6. Tạo handshake, thử xác nhận sau 600 giây: API trả HTTP 410 và owner không đổi. Hai xác nhận trước hạn sẽ chuyển owner trên chain.

API chi tiết và payload mẫu nằm trong [README.md](README.md#api).
