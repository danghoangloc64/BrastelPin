# Brastel PIN Checker

Một hệ thống kiểm tra PIN Brastel với khả năng xoay vòng proxy và xử lý đồng thời nhiều worker.

## Tính năng mới: Ntfy Notification

### Cấu hình Ntfy

Tính năng notification qua ntfy đã được tích hợp vào hệ thống. Khi tìm thấy PIN hợp lệ, hệ thống sẽ tự động gửi notification đến topic `dhloc` trên ntfy.sh.

#### Cấu hình trong code:

```javascript
// Trong file brastel-pin-checker.js, phần CONFIG
ntfy: {
  enabled: true, // Bật/tắt notification (true/false)
  server: 'https://ntfy.sh', // Server ntfy (mặc định: ntfy.sh)
  topic: 'dhloc', // Topic để gửi notification
  priority: '5' // Độ ưu tiên (1-5, 5 là cao nhất)
}
```

#### Cách sử dụng:

1. **Đăng ký topic trên ntfy.sh:**
   - Truy cập https://ntfy.sh
   - Đăng ký topic `dhloc`
   - Hoặc sử dụng topic khác bằng cách thay đổi `CONFIG.ntfy.topic`

2. **Cấu hình notification:**
   - Bật/tắt: Thay đổi `CONFIG.ntfy.enabled`
   - Thay đổi topic: Sửa `CONFIG.ntfy.topic`
   - Thay đổi server: Sửa `CONFIG.ntfy.server` (nếu sử dụng server ntfy riêng)

3. **Chạy chương trình:**
   ```bash
   npm start
   ```

#### Thông tin notification:

Khi tìm thấy PIN hợp lệ, notification sẽ bao gồm:
- **Tiêu đề:** 🎯 Brastel PIN Found!
- **Nội dung:** 
  - Access Code
  - PIN tìm được
  - Worker ID
  - Thời gian tìm thấy

#### Ví dụ notification:

```
🎯 Brastel PIN Found!

Access Code: 74974423
PIN: 1234
Worker: 1
Time: 12/15/2024, 3:45:30 PM
```

### Cài đặt

```bash
npm install
```

### Chạy

```bash
# Chạy PIN checker
npm start

# Chạy web GUI
npm run gui
```

### Cấu hình khác

Xem file `brastel-pin-checker.js` để cấu hình:
- Access codes và PIN ranges
- Số lượng worker đồng thời
- Proxy settings
- Cookie configurations 