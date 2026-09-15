# Hướng Dẫn Cài Đặt & Khởi Chạy Dự Án (Installation & Setup Guide)

Tài liệu này hướng dẫn chi tiết cách cài đặt các công cụ cần thiết, thiết lập mạng Blockchain cục bộ (**Ganache**), cấu hình cơ sở dữ liệu và khởi chạy hệ thống **AuthentiFi**.

---

## 1. Các Công Cụ Cần Chuẩn Bị (Prerequisites)

| Công cụ | Mô tả | Yêu cầu |
| :--- | :--- | :--- |
| **Node.js** | Môi trường chạy backend JavaScript | Khuyên dùng Node 18, 20 hoặc 24 LTS |
| **Ganache** | Mạng blockchain Ethereum cục bộ (local testnet) | Bản GUI hoặc CLI cổng `7545` |
| **MySQL Database** | Cơ sở dữ liệu lưu thông tin User / Retailer | MySQL local (XAMPP/Workbench) hoặc Cloud FreeSQLDatabase |
| **Git** | Quản lý mã nguồn | Bản mới nhất |

---

## 2. Hướng Dẫn Cài Đặt & Cấu Hình Ganache

> **Ganache là gì?**  
> Ganache là một mạng blockchain Ethereum giả lập chạy trực tiếp trên máy tính của bạn. Nó cung cấp sẵn 10 tài khoản thử nghiệm (mỗi tài khoản có 100 ETH miễn phí) để bạn thử nghiệm deploy Smart Contract và ký các giao dịch mà không tốn tiền thật.

### Cách 1: Cài đặt Ganache GUI (Giao diện đồ họa - Khuyên dùng)
1. **Tải bộ cài đặt:**
   - Truy cập trang chủ: [https://trufflesuite.com/ganache/](https://trufflesuite.com/ganache/)
   - Tải file cài đặt cho Windows (thường là file `.appx` hoặc `.exe` từ [GitHub Releases](https://github.com/trufflesuite/ganache-ui/releases)).
2. **Khởi chạy & Tạo mạng:**
   - Mở ứng dụng **Ganache** lên.
   - Chọn mục **Quickstart (Ethereum)**.
3. **Cấu hình Cổng kết nối (Port 7545):**
   - Bấm vào **biểu tượng bánh răng (Settings)** ở góc trên cùng bên phải.
   - Chuyển sang tab **Server**:
     - **Hostname:** `127.0.0.1 - Loopback Pseudo-Interface 1`
     - **Port Number:** Điền **`7545`** *(Bắt buộc phải là 7545 để khớp với mã nguồn)*
     - **Network ID:** `5777`
   - Nhấn nút **Save and Restart** ở góc trên bên phải.
4. **Lưu ý:** Giữ cửa sổ Ganache này **luôn luôn mở** trong suốt quá trình bạn chạy dự án.

---

### Cách 2: Chạy Ganache bằng dòng lệnh (Không cần cài ứng dụng)
Nếu bạn không muốn cài phần mềm đồ họa, chỉ cần mở một cửa sổ Terminal (PowerShell/CMD) riêng và chạy lệnh:
```bash
npx ganache --port 7545
```
*(Giữ cửa sổ terminal này chạy ngầm)*

---

## 3. Cài Đặt Thư Viện Dự Án (Dependencies)

Mở terminal tại thư mục dự án `AuthentiFi` và chạy lệnh:

```bash
npm install
```

---

## 4. Biên Dịch & Deploy Smart Contract (Tự Động 100%)

Dự án đã được tích hợp sẵn các lệnh biên dịch và deploy tự động, **bạn không cần phải dùng Remix**:

1. **Biên dịch Smart Contract:**
   ```bash
   npm run compile
   ```
   *(Lệnh này sẽ tự động tạo file ABI và Bytecode trong thư mục `build/`)*

2. **Deploy Smart Contract lên Ganache:**
   ```bash
   npm run deploy
   ```
   - Script sẽ tự động kết nối tới Ganache ở cổng `7545`.
   - Lấy tài khoản đầu tiên để triển khai hợp đồng `Authentifi`.
   - **Tự động điền địa chỉ Smart Contract** mới deploy vào dòng 418 của file `server.js`.

---

## 5. Cấu Hình Cơ Sở Dữ Liệu (File `.env`)

Mở file `.env` tại thư mục gốc của dự án để cấu hình thông tin kết nối MySQL:

### Tùy chọn A: Dùng Database Cloud miễn phí (Đã cấu hình sẵn)
Dự án đã được tạo sẵn Database trên Cloud FreeSQLDatabase, bạn chỉ cần giữ nguyên file `.env`:
```env
database_host=sql12.freesqldatabase.com
database_name=sql12837112
database_user=sql12837112
database_password=123456
secret=authentifi_secret_key_2026
PORT=8080
```

### Tùy chọn B: Dùng MySQL Local (XAMPP / MySQL Server trên máy)
Nếu bạn muốn dùng MySQL trên máy cá nhân:
1. Sửa file `.env`:
   ```env
   database_host=localhost
   database_name=authentifi
   database_user=root
   database_password=mat_khau_mysql_cua_ban
   secret=authentifi_secret_key_2026
   PORT=8080
   ```
2. Chạy câu lệnh SQL sau trong MySQL để tạo cơ sở dữ liệu và các bảng:
   ```sql
   CREATE DATABASE IF NOT EXISTS authentifi;
   USE authentifi;

   CREATE TABLE IF NOT EXISTS USER (
       Name VARCHAR(255) NOT NULL,
       Email VARCHAR(255) PRIMARY KEY,
       Password VARCHAR(255) NOT NULL,
       Phone VARCHAR(50)
   );

   CREATE TABLE IF NOT EXISTS RETAILER (
       retailerName VARCHAR(255) NOT NULL,
       retailerEmail VARCHAR(255) PRIMARY KEY,
       retailerLocation VARCHAR(255),
       retailerHashedPassword VARCHAR(255) NOT NULL
   );
   ```

---

## 6. Khởi Chạy Ứng Dụng

Chạy lệnh:
```bash
npm start
```
*(hoặc `node server.js`)*

Khi màn hình terminal hiển thị:
```text
Talking with a geth server 0.20.6 
Listening to port 8080...
Connected to MySql!
```
Nghĩa là hệ thống đã khởi chạy thành công!

---

## 7. Truy Cập Hệ Thống

Mở trình duyệt web và sử dụng các đường dẫn sau:

- **Trang chủ:** [http://localhost:8080/](http://localhost:8080/)
- **Nhà sản xuất tạo mã QR cho sản phẩm:** [http://localhost:8080/createCodes](http://localhost:8080/createCodes)
- **Tạo tài khoản đại lý bán lẻ:** [http://localhost:8080/createRetailer](http://localhost:8080/createRetailer)

---

## 8. Xử Lý Các Lỗi Thường Gặp (Troubleshooting)

1. **Lỗi `Invalid JSON RPC response: undefined` hoặc `ECONNREFUSED`:**
   - **Nguyên nhân:** Chưa bật Ganache hoặc Ganache đang chạy sai cổng.
   - **Xử lý:** Mở ứng dụng Ganache và đảm bảo cổng hiển thị là `7545`.

2. **Lỗi `EADDRINUSE: address already in use :::8080`:**
   - **Nguyên nhân:** Đang có một tiến trình `node server.js` khác chạy ngầm chiếm cổng 8080.
   - **Xử lý:** Mở Task Manager tắt bớt tiến trình `Node.js` hoặc đổi `PORT=3000` trong file `.env`.
