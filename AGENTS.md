\# 🤖 AGENTS.MD: HƯỚNG DẪN HOÀN THIỆN PHÂN HỆ XÁC THỰC CHỐNG HÀNG GIẢ (AUTHENTIFI)



\## 📌 1. Bối cảnh \& Mục tiêu (Context \& Objective)



\* \*\*Tên dự án:\*\* AuthentiFi - Hệ thống Quản lý Quyền sở hữu Sản phẩm \& Truy xuất Nguồn gốc Chống hàng giả trên Blockchain.





\* \*\*Mục tiêu của Agent:\*\* Hoàn thiện module cốt lõi \*\*Xác thực chống hàng giả\*\* theo kiến trúc Hybrid (On-chain Ethereum + Off-chain MySQL).





\* \*\*Phạm vi hoàn thiện:\*\*

1\. Triển khai Smart Contract `authentifi.sol` quản lý trạng thái mã băm và số lượt quét `scanCount`.





2\. Xây dựng CSDL Off-chain `SCAN\_LOGS` để lưu vết vị trí, IP và phát hiện bất thường.





3\. Viết thuật toán sinh mã QR động mã hóa kèm Salt \& Timestamp.





4\. Cài đặt Middleware API `POST /api/verify` xử lý thuật toán phát hiện nhân bản tem (QR Duplication Attack).





5\. Xây dựng giao diện trích xuất Camera quét mã (`verify.html`) hiển thị cảnh báo Thẻ Xanh / Thẻ Đỏ.





6\. Triển khai cơ chế Bắt tay 2 chiều (Two-way Handshake) chuyển giao quyền sở hữu giới hạn thời gian (TTL ≤ 600s).











\---



\## 🏗️ 2. Kiến trúc Hệ thống Hybrid (System Architecture)



Agent cần nắm rõ mô hình phân tách dữ liệu:



\* \*\*On-chain (Ganache / Ethereum Testnet):\*\* Lưu trữ mã băm đại diện `bytes32`, trạng thái kích hoạt `isVerified`, bộ đếm lượt quét `scanCount`, địa chỉ chủ sở hữu `currentOwner` và timestamp.





\* \*\*Off-chain (MySQL Server):\*\* Lưu thông tin chi tiết sản phẩm, tài khoản người dùng/đại lý, và nhật ký lượt quét `SCAN\_LOGS` (IP, tọa độ GPS, thời gian).







\---



\## 🛠️ 3. Lộ trình Triển khai Chi tiết từng Bước (Step-by-Step Directives)



\### 🔹 Bước 1: Hoàn thiện Smart Contract (`authentifi.sol`)



Agent cần kiểm tra và triển khai hợp đồng thông minh Solidity trên môi trường Ganache local.



\* \*\*Cấu trúc dữ liệu Struct:\*\*

```solidity

struct codeObj {

&#x20;   bytes32 code;          // Mã băm SHA-256 duy nhất của sản phẩm\[cite: 2]

&#x20;   bool isVerified;       // Trạng thái kích hoạt xuất kho\[cite: 2]

&#x20;   uint256 scanCount;     // Bộ đếm số lượt quét (chống tem photocopy)\[cite: 2]

&#x20;   uint256 activationTime;// Thời điểm kích hoạt\[cite: 2]

&#x20;   address currentOwner;  // Địa chỉ ví chủ sở hữu hiện tại\[cite: 2]

}



```





\* \*\*Các hàm nghiệp vụ bắt buộc:\*\*

\* `createCode(bytes32 \_codeHash)`: Đóng băng mã băm khởi tạo On-chain.





\* `activateProduct(bytes32 \_codeHash)`: Chuyển `isVerified = true` trước khi xuất kho.





\* `verifyProduct(bytes32 \_codeHash)`: Kiểm tra mã băm, tăng `scanCount += 1` và trả về `scanCount` hiện tại.





\* `changeOwner(bytes32 \_codeHash, address \_newOwner)`: Chuyển giao quyền sở hữu sản phẩm.











\---



\### 🔹 Bước 2: Khởi tạo Cơ sở Dữ liệu Off-chain (MySQL)



Agent cần tạo bảng `SCAN\_LOGS` trong MySQL để phục vụ việc lưu nhật ký đối soát lượt quét:



```sql

CREATE TABLE SCAN\_LOGS (

&#x20;   log\_id INT AUTO\_INCREMENT PRIMARY KEY,

&#x20;   product\_code VARCHAR(64) NOT NULL,

&#x20;   scan\_time DATETIME NOT NULL,

&#x20;   ip\_address VARCHAR(45) NULL,

&#x20;   location\_data VARCHAR(255) NULL,

&#x20;   anomaly\_flag BOOLEAN DEFAULT 0,

&#x20;   INDEX idx\_product\_code (product\_code)

);



```



\---



\### 🔹 Bước 3: Thuật toán Sinh mã QR Chống giả chứa Salt \& Timestamp



Tại API `/QRCodeForManufacturer` (Backend Node.js/Express):



1\. \*\*Đầu vào:\*\* Tên sản phẩm, Mã lô hàng, Serial ID, UID.





2\. \*\*Xử lý:\*\*

\* Sinh chuỗi ngẫu nhiên Salt (entropy 128-bit).





\* Lấy `Timestamp` hiện tại.





\* Tính toán mã băm: `ProductCode = SHA256(Brand + Model + Serial + Timestamp + Salt)`.









3\. \*\*Ghi nhận:\*\*

\* Gọi Smart Contract thực thi `createCode(ProductCode)`.





\* Tạo file ảnh QR chứa URL xác thực (VD: `\[https://authentifi.app/verify?code=](https://authentifi.app/verify?code=)<ProductCode>`).











\---



\### 🔹 Bước 4: Middleware API Xác thực \& Cảnh báo Tem giả (`POST /api/verify`)



Agent cần cài đặt logic phân loại kết quả xác thực theo bảng sau:



\* \*\*Luồng xử lý:\*\*

1\. Trích xuất `codeHash` từ dữ liệu quét QR, lấy `IP` và vị trí `Location` của thiết bị người dùng.





2\. Gọi Smart Contract `verifyProduct(codeHash)` để nhận về `scanCount`.





3\. Ghi vết thông tin lượt quét vào bảng `SCAN\_LOGS`.





4\. Đánh giá kịch bản phản hồi:











| Trạng thái On-chain | Trạng thái Off-chain | Phản hồi Giao diện | Thông điệp cảnh báo |

| --- | --- | --- | --- |

| Mã hợp lệ, `scanCount == 1`<br> | Lần đầu ghi nhận



&#x20;| 🟢 \*\*THẺ XANH\*\*<br> | HÀNG CHÍNH HÃNG - Xác thực lần đầu thành công.



&#x20;|

| Mã hợp lệ, `scanCount > 1`<br> | Vết quét trùng lặp



&#x20;| 🔴 \*\*THẺ ĐỎ\*\*<br> | CẢNH BÁO NGHI VẤN HÀNG GIẢ - Tem QR có dấu hiệu bị sao chép/photocopy.



&#x20;|

| Mã KHÔNG tồn tại On-chain



&#x20;| Không có bản ghi



&#x20;| 🔴 \*\*THẺ ĐỎ\*\*<br> | MÃ KHÔNG HỢP LỆ - Mã sản phẩm không tồn tại trên Sổ cái.



&#x20;|



\---



\### 🔹 Bước 5: Cơ chế Bắt tay 2 Chiều Chuyển giao Quyền sở hữu (Handshake Protocol)



Agent triển khai quy trình xác nhận giao nhận giữa bên bán (Đại lý) và bên mua (Người tiêu dùng):



\* Khi kích hoạt chuyển giao sở hữu, API sinh `Session Token` kèm giới hạn thời gian (TTL ≤ 600 giây).





\* Cả hai bên phải xác nhận đồng thuận trong khoảng thời gian TTL trước khi lệnh `changeOwner()` được ghi nhận chính thức lên Smart Contract.





\* Nếu quá thời gian 600s, phiên làm việc hết hạn (`Expired`) và giao dịch bị hủy bỏ để đảm bảo an toàn.







\---



\### 🔹 Bước 6: Hoàn thiện Giao diện Quét mã (`verify.html`)



Agent tích hợp thư viện JavaScript `html5-qrcode` trên giao diện Web Frontend:



\* Mở camera di động/webcam cho phép người dùng quét trực tiếp tem QR.





\* Trích xuất mã băm, tự động gửi payload tới API `POST /api/verify`.





\* Hiển thị giao diện trực quan:

\* \*\*Thẻ Xanh:\*\* Kèm Vertical Timeline hiển thị hành trình chuyển giao từ Nhà sản xuất ➔ Đại lý ➔ Người mua.





\* \*\*Thẻ Đỏ:\*\* Cảnh báo nổi bật lượt quét bất thường (`scanCount > 1`) và địa điểm/thời gian đã quét trước đó.











\---



\## 🧪 4. Danh mục Kịch bản Kiểm thử (Test Cases Verification)



Agent cần thực hiện kiểm thử tự động/thủ công theo 6 kịch bản bắt buộc sau:



1\. \*\*TC-01 (Tạo mã):\*\* Nhập lô hàng ➔ Tạo mã băm SHA-256 thành công trên Ganache.





2\. \*\*TC-02 (Kích hoạt):\*\* Gọi `activateProduct()` ➔ Cờ `isVerified = true`.





3\. \*\*TC-03 (Xác thực hợp lệ lần 1):\*\* Quét tem thật ➔ `scanCount = 1` ➔ Hiển thị \*\*Thẻ Xanh\*\*.





4\. \*\*TC-04 (Cảnh báo tem photocopy):\*\* Quét lại tem đã quét ➔ `scanCount > 1` ➔ Hiển thị \*\*Thẻ Đỏ\*\*.





5\. \*\*TC-05 (Mã giả mạo):\*\* Quét mã QR tự tạo không nằm trên Ganache ➔ Báo lỗi \*\*Mã không hợp lệ\*\*.





6\. \*\*TC-06 (Bắt tay hết hạn):\*\* Thực hiện `changeOwner()` sau quá 600s ➔ Lệnh bị từ chối, giữ nguyên chủ sở hữu cũ.



