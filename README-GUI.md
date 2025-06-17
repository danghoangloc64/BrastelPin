# Brastel PIN Checker - Web GUI Interface

Giao diện web hiện đại để cấu hình và chạy Brastel PIN Checker một cách dễ dàng mà không cần sửa code.

## 🌟 Tính năng

- **Giao diện web thân thiện**: UI/UX hiện đại với responsive design
- **Cấu hình trực quan**: Điền form thay vì sửa code
- **Quản lý multi-access codes**: Thêm/xóa nhiều access code dễ dàng
- **Real-time status**: Theo dõi tiến trình xử lý trực tiếp
- **Validation**: Kiểm tra dữ liệu đầu vào tự động
- **Mobile-friendly**: Tối ưu cho cả desktop và mobile

## 🚀 Cách sử dụng

### 1. Cài đặt dependencies

```bash
npm install
```

### 2. Khởi chạy Web GUI

```bash
npm run gui
```

Hoặc:

```bash
node web-gui.js
```

### 3. Mở trình duyệt

Truy cập: `http://localhost:3000`

### 4. Cấu hình và chạy

1. **Access Codes Configuration**:
   - Nhập access code (vd: 74974423)
   - Thiết lập PIN range (start - end)
   - Thêm nhiều access code nếu cần

2. **Basic Settings**:
   - Concurrent Workers: Số worker chạy đồng thời
   - Max Undefined Results: Giới hạn lỗi undefined
   - Random Processing: Bật/tắt chế độ random

3. **Advanced Settings** (tùy chọn):
   - Max Retries: Số lần thử lại
   - Retry Delay: Thời gian chờ giữa các lần thử
   - Delay Between PINs: Thời gian chờ giữa các PIN

4. **Nhấn "Start PIN Checking"** để bắt đầu

## 📊 Theo dõi tiến trình

- **Job Status**: Hiển thị trạng thái real-time
- **Console Output**: Xem chi tiết trong terminal
- **Result Files**: Kiểm tra folder `Data/` cho kết quả

## 📁 Cấu trúc file kết quả

```
Data/
├── {accessCode}/
│   ├── sent_pins_history.json
│   ├── blacklist_pins.json
│   └── valid_pins_found.json
└── ...

Log/
├── log_{accessCode}.txt
└── ...
```

## 🎯 Ưu điểm của Web GUI

### So với chỉnh sửa code trực tiếp:

- ✅ **Không cần kiến thức lập trình**
- ✅ **Validation tự động**
- ✅ **Giao diện trực quan**
- ✅ **Theo dõi real-time**
- ✅ **Mobile responsive**
- ✅ **Ít lỗi sai cấu hình**

### Workflow đơn giản:

1. Mở browser → Điền form → Nhấn Start
2. Theo dõi tiến trình qua web interface
3. Kiểm tra kết quả trong folder Data/

## 🔧 API Endpoints

Web GUI cung cấp các API endpoints:

- `POST /api/start-checker`: Khởi chạy PIN checker
- `GET /api/job-status/:jobId`: Lấy trạng thái job
- `GET /api/jobs`: Danh sách tất cả jobs

## ⚡ Tips & Tricks

1. **Chạy multiple access codes**: Chương trình sẽ xử lý tuần tự từng access code
2. **Blacklist management**: Valid PINs có thể được thêm vào blacklist để continue searching
3. **Random vs Sequential**: Random mode giúp tránh pattern detection
4. **Concurrent workers**: Tăng số worker để xử lý nhanh hơn (cẩn thận với rate limiting)

## 🛡️ Bảo mật

- Chỉ chạy trên localhost (127.0.0.1:3000)
- Không expose ra internet
- Dữ liệu lưu local files

## 🐛 Troubleshooting

### Lỗi thường gặp:

1. **Port 3000 đã sử dụng**:
   ```bash
   # Thay đổi PORT trong web-gui.js
   const PORT = 3001;
   ```

2. **Express không cài đặt**:
   ```bash
   npm install express
   ```

3. **Folder permission**:
   - Đảm bảo quyền write cho folder hiện tại

### Log debugging:

- Xem terminal console khi chạy `npm run gui`
- Kiểm tra browser Developer Tools (F12)
- Xem log files trong folder `Log/`

## 📝 So sánh với CLI version

| Feature | CLI (brastel-pin-checker.js) | Web GUI |
|---------|------------------------------|---------|
| Ease of use | Cần sửa code | Point & click |
| Configuration | Manual code edit | Visual form |
| Status tracking | Terminal only | Web + Terminal |
| Multi-user | No | Yes (localhost) |
| Mobile access | No | Yes |
| Error handling | Manual | Automated |

## 🔄 Workflow khuyến nghị

1. **Lần đầu sử dụng**: Dùng Web GUI để hiểu workflow
2. **Batch processing**: Có thể dùng CLI cho automation
3. **Monitoring**: Web GUI tốt cho theo dõi interactive
4. **Production**: CLI tốt cho scheduled jobs

---

**💡 Tip**: Web GUI là wrapper around CLI version, nên tất cả features và settings đều tương đương nhau!