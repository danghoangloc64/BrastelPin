# 🎯 Brastel PIN Checker - Refactored

Một tool kiểm tra PIN Brastel được refactor với tính năng tracking và quản lý blacklist.

## ✨ Tính năng mới

### 🔧 0. ESLint Configuration
- Đã setup ESLint với config phù hợp cho Node.js
- Code style consistent và clean
- Chạy `npm run lint` để check code
- Chạy `npm run lint:fix` để auto-fix các issues

### 📝 1. PIN History Tracking
- **File**: `Data/{accessCode}/sent_pins_history.json`
- **Mục đích**: Lưu lại tất cả các PIN đã gửi theo từng accessCode
- **Lợi ích**: Khi restart app, sẽ không gửi lại các PIN đã gửi rồi
- **Format**:
```json
[
  "9995",
  "9996",
  "9997"
]
```

### 🚫 2. PIN Blacklist Management
- **File**: `Data/{accessCode}/blacklist_pins.json`
- **Mục đích**: Danh sách các PIN không đúng nhưng trả về success theo từng accessCode
- **Lợi ích**: Nếu PIN trong blacklist mà trả về success, tool sẽ tiếp tục chạy thay vì dừng
- **Format**:
```json
[
  "9995",
  "9996"
]
```

### 🎯 3. Valid PINs Results
- **File**: `Data/{accessCode}/valid_pins_found.json`
- **Mục đích**: Lưu các PIN hợp lệ đã tìm thấy theo từng accessCode
- **Format**:
```json
[
  {
    "pin": "9999",
    "accessCode": "82819563",
    "timestamp": "2025-06-17T01:43:28.876Z"
  }
]
```

## 🚀 Cách sử dụng

### Installation
```bash
npm install
```

### Chạy tool
```bash
npm start
# hoặc
node brastel-pin-checker.js
```

### Kiểm tra code quality
```bash
npm run lint        # Check issues
npm run lint:fix    # Auto-fix issues
```

## ⚙️ Configuration

Tất cả config được centralize trong object `CONFIG`:

```javascript
const CONFIG = {
  // PIN range để check
  pinRange: {
    start: 5410,
    end: 5420
  },
  
  // Số workers concurrent
  concurrentWorkers: 1,
  
  // Retry settings
  maxRetries: 5,
  retryDelay: 3000,
  
  // Files để tracking
  files: {
    sentPins: 'sent_pins_history.json',
    blacklistPins: 'blacklist_pins.json',
    validPins: 'valid_pins_found.json'
  }
};
```

## 📁 Files được tạo tự động

Khi chạy lần đầu, tool sẽ tự động tạo folder và files theo accessCode:

1. **`Data/{accessCode}/`** - Folder riêng cho từng accessCode
2. **`Data/{accessCode}/sent_pins_history.json`** - Lịch sử PIN đã gửi
3. **`Data/{accessCode}/blacklist_pins.json`** - Danh sách PIN blacklist
4. **`Data/{accessCode}/valid_pins_found.json`** - Kết quả PIN hợp lệ
5. **`Log/log_{accessCode}_YYYY-MM-DD...txt`** - File log với accessCode và timestamp

## 🛠️ Workflow

1. **Khởi động**: Tool tạo folder `Data/{accessCode}/` và đọc các file tracking
2. **Skip PIN đã gửi**: Bỏ qua các PIN trong `Data/{accessCode}/sent_pins_history.json`
3. **Gửi request**: Gửi request cho PIN mới
4. **Lưu lịch sử**: Thêm PIN vào `Data/{accessCode}/sent_pins_history.json`
5. **Kiểm tra kết quả**:
   - Nếu success + PIN trong blacklist → tiếp tục
   - Nếu success + PIN không trong blacklist → dừng và lưu vào `Data/{accessCode}/valid_pins_found.json`
   - Nếu fail → tiếp tục PIN tiếp theo

## 📊 Statistics

Tool sẽ hiển thị thống kê:
- Tổng số PIN đã gửi
- Số PIN trong blacklist
- Số PIN hợp lệ tìm thấy

## 🔄 Quản lý Blacklist

### Thêm PIN vào blacklist:
```javascript
// Cách 1: Chỉnh sửa file Data/{accessCode}/blacklist_pins.json
[
  "9995",
  "9996",
  "9997"
]

// Cách 2: Sử dụng API (trong code)
fileManager.addBlacklistPin("9998");
```

### Xem blacklist hiện tại:
Tool sẽ hiển thị trong statistics khi chạy.

## 🎨 Code Structure

```
├── FileManager     - Quản lý files tracking
├── Logger          - Logging với emoji và levels
├── ProxyManager    - Quản lý proxy (static/dynamic)
├── PinChecker      - Logic kiểm tra PIN chính
├── Worker          - Xử lý concurrent workers
└── BrastelPinChecker - Main application class
```

## 📝 Logs

Logs có emoji để dễ theo dõi:
- 🔍 INFO - Thông tin chung
- ❌ ERROR - Lỗi
- ✅ SUCCESS - Thành công
- ⚠️ WARNING - Cảnh báo
- 🛡️ PROXY - Proxy operations
- 🎯 FOUND - Tìm thấy PIN hợp lệ
- ⏭️ SKIP - Bỏ qua PIN

## 🔧 Troubleshooting

### Tool không bỏ qua PIN đã gửi?
- Kiểm tra file `Data/{accessCode}/sent_pins_history.json` có tồn tại không
- Kiểm tra format JSON có đúng không

### PIN trong blacklist vẫn dừng tool?
- Kiểm tra file `Data/{accessCode}/blacklist_pins.json`
- Đảm bảo PIN format đúng (4 số với leading zero)

### Muốn reset và chạy lại từ đầu?
```bash
# Xóa folder của accessCode cụ thể
rmdir /s Data\82819563
# Hoặc xóa toàn bộ data
rmdir /s Data
# Chạy lại
npm start
```

## 🚀 Advanced Usage

### Enable dynamic proxy rotation:
Uncomment các dòng trong `Worker.process()`:
```javascript
// if (Date.now() - lastRotate > CONFIG.proxyRotationInterval) {
//   this.logger.info(`Worker ${this.id}: Rotating proxy after 250 seconds...`);
//   const proxyData = await this.proxyManager.getNewProxy(apiKey);
//   agent = proxyData.agent;
//   lastRotate = proxyData.lastRotate;
// }
```

---

Made with ❤️ - Refactored version with tracking & blacklist features 