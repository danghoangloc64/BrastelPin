# 🚀 Quick Start - Web GUI với Proxies & Live Logs

## ✨ Tính năng mới đã thêm:

### 1. **📡 Quản lý Proxies & Cookies trên GUI**
- Không cần sửa code nữa
- Cập nhật trực tiếp trên web interface
- Rotation tự động giữa multiple proxies/cookies

### 2. **📊 Live Logs Real-time**
- Hiển thị 10 dòng log mới nhất
- Auto-refresh mỗi 2 giây
- Console-style display với màu xanh trên nền đen

## 🎯 Cách sử dụng nhanh:

### Bước 1: Khởi chạy
```bash
npm run gui
```

### Bước 2: Mở browser
```
http://localhost:3000
```

### Bước 3: Cấu hình

#### 🔑 Access Codes
- Access Code: `74974423` (có sẵn)
- PIN Range: `5410` - `9999` (có sẵn)
- Thêm multiple codes nếu cần

#### 🛡️ Proxies & Cookies (MỚI!)
- **Proxies**: Để trống sẽ không dùng proxy
  ```
  http://proxy1:8080
  http://proxy2:8080
  (để trống để không dùng proxy)
  ```

- **Cookies**: ⚠️ BẮT BUỘC phải có ít nhất 1 cookie!
  ```
  _ga=GA1.2.2004863075.1749788627; ASP.NET_SessionId=kkmvt2y4ni0d4bp1sg0vz3xf; ...
  ASPSESSIONID=...; AWSELB=...; ...
  ```

#### ⚙️ Settings
- **Workers**: `1` (khuyến nghị)
- **Max Undefined**: `25`
- **Random Processing**: ✅ Bật để tránh detection

### Bước 4: Chạy & Theo dõi

1. **Nhấn "Start PIN Checking"**
2. **Theo dõi Job Status** - hiển thị trạng thái real-time
3. **Xem Live Logs** - 10 dòng log mới nhất, tự động cập nhật
4. **Kiểm tra kết quả** trong folder `Data/`

## 🔥 Các tính năng nổi bật:

### Real-time Monitoring
- **Job Status**: Running, Completed, Error
- **Start/End Time**: Thời gian bắt đầu và kết thúc
- **Live Logs**: Console output trực tiếp trên web

### Smart Configuration
- **Proxy Rotation**: Each worker dùng proxy khác nhau
- **Cookie Rotation**: Each worker dùng cookie khác nhau
- **Validation**: Tự động kiểm tra input hợp lệ

### User-friendly Interface
- **Responsive Design**: Hoạt động tốt trên mobile
- **Modern UI**: Gradient backgrounds, animations
- **Error Handling**: Alert messages rõ ràng

## 📁 Cấu trúc kết quả:

```
Data/
├── 74974423/
│   ├── sent_pins_history.json      # PINs đã gửi
│   ├── blacklist_pins.json         # PINs bị blacklist
│   └── valid_pins_found.json       # PINs valid tìm được
└── 33849108/
    ├── sent_pins_history.json
    ├── blacklist_pins.json
    └── valid_pins_found.json

Log/
├── log_74974423.txt               # Logs cho accessCode
└── log_33849108.txt
```

## ⚡ Tips & Tricks:

### 🎯 Proxy Configuration
```
http://proxy1:8080
http://proxy2:8080

socks5://proxy3:1080
```
- Để dòng trống = không dùng proxy cho worker đó
- Mix HTTP/SOCKS5 proxies OK

### 🍪 Cookie Management
```
cookie1=value1; session=abc123
cookie2=value2; session=def456
cookie3=value3; session=ghi789
```
- Mỗi worker sẽ dùng cookie khác nhau
- Thêm nhiều cookies để tránh rate limiting

### 📊 Monitoring
- **Live Logs**: Cập nhật mỗi 2 giây
- **Job Status**: Cập nhật mỗi 3 giây
- **Auto-scroll**: Logs tự động scroll xuống bottom

## 🛠️ Troubleshooting:

### ❌ "At least one cookie is required"
→ Nhập ít nhất 1 cookie trong Cookies field

### ❌ Port 3000 busy
→ Thay đổi PORT trong `web-gui.js`

### ❌ No logs showing
→ Kiểm tra folder `Log/` có files `.txt` không

### ❌ Job status stuck
→ Refresh browser hoặc check terminal console

## 🔄 Workflow hoàn chỉnh:

1. **Setup**: `npm run gui` → mở browser
2. **Configure**: Điền access codes + proxies + cookies
3. **Start**: Nhấn nút Start
4. **Monitor**: Xem live logs + job status
5. **Results**: Check folder `Data/` cho valid PINs
6. **Iterate**: Thêm valid PINs vào blacklist nếu muốn continue

---

**🎉 Enjoy the enhanced Web GUI with proxies management and live logs!**

Web GUI bây giờ đã hoàn toàn self-contained - không cần sửa code nữa!