# Brastel PIN Checker - SSH/CLI Version

🚀 **Brastel PIN Checker** với giao diện dòng lệnh (CLI) được tối ưu cho việc sử dụng qua SSH. Hỗ trợ kiểm tra PIN đa luồng với proxy rotation và concurrent workers.

## 🎯 Tính năng chính

- ✅ **Giao diện CLI hoàn chỉnh** - Dễ sử dụng qua SSH
- ✅ **Đa luồng (Multi-threading)** - Xử lý nhiều PIN cùng lúc
- ✅ **Hỗ trợ nhiều Access Code** - Kiểm tra nhiều tài khoản
- ✅ **Proxy rotation** - Tự động xoay proxy
- ✅ **Thông báo Ntfy** - Thông báo khi tìm thấy PIN hợp lệ
- ✅ **Lưu trữ dữ liệu** - Theo dõi tiến độ và kết quả
- ✅ **Cấu hình linh hoạt** - Dễ dàng tùy chỉnh

## 📦 Cài đặt

### 1. Clone repository
```bash
git clone <repository-url>
cd BrastelPin
```

### 2. Cài đặt dependencies
```bash
npm install
```

### 3. Cấu hình (tùy chọn)
```bash
# Tạo file cấu hình CLI
node cli.js config
```

## 🚀 Sử dụng qua SSH

### Các lệnh cơ bản

#### 1. Hiển thị trợ giúp
```bash
node cli.js help
```

#### 2. Bắt đầu kiểm tra PIN
```bash
# Chế độ cơ bản
node cli.js start

# Với các tùy chọn
node cli.js start --workers 3 --random --delay 200

# Với số lượng worker tối đa
node cli.js start --workers 5 --max-undefined 50
```

#### 3. Xem thống kê
```bash
# Thống kê tất cả access codes
node cli.js stats

# Thống kê cho access code cụ thể
node cli.js stats 74974423
```

#### 4. Xem cấu hình hiện tại
```bash
node cli.js config
```

#### 5. Thay đổi cấu hình
```bash
# Thay đổi số lượng worker
node cli.js config set concurrentWorkers 5

# Bật/tắt chế độ random
node cli.js config set randomProcessing.enabled true

# Thay đổi delay giữa các PIN
node cli.js config set randomProcessing.delayBetweenPins 150
```

#### 6. Xem trạng thái
```bash
node cli.js status
```

### Các tùy chọn cho lệnh `start`

| Tùy chọn | Mô tả | Ví dụ |
|----------|-------|-------|
| `--workers <số>` | Số lượng worker đồng thời | `--workers 3` |
| `--random` | Bật chế độ xử lý ngẫu nhiên | `--random` |
| `--max-undefined <số>` | Giới hạn kết quả undefined | `--max-undefined 50` |
| `--delay <ms>` | Thời gian delay giữa các PIN | `--delay 200` |

## 📊 Cấu hình Access Codes

Mặc định, ứng dụng được cấu hình với 2 access codes:

```javascript
accessCodes: [
  {
    accessCode: '74974423',
    pinRange: { start: 5410, end: 9999 }
  },
  {
    accessCode: '33849108',
    pinRange: { start: 0, end: 9999 }
  }
]
```

### Thay đổi Access Codes

Bạn có thể chỉnh sửa trực tiếp file `cli-config.json` hoặc sử dụng lệnh:

```bash
# Tạo file cấu hình mới
node cli.js config > cli-config.json
```

## 🛡️ Cấu hình Proxy

Để thêm proxy, chỉnh sửa mảng `proxies` trong cấu hình:

```bash
node cli.js config set proxies '["http://proxy1:port", "http://proxy2:port"]'
```

## 🍪 Cấu hình Cookies

Cookies được cấu hình sẵn trong file chính. Để cập nhật, chỉnh sửa mảng `cookies` trong `brastel-pin-checker.js`.

## 📱 Thông báo Ntfy

Cấu hình thông báo qua Ntfy:

```bash
# Bật/tắt thông báo
node cli.js config set ntfy.enabled true

# Thay đổi topic
node cli.js config set ntfy.topic "your-topic-name"

# Thay đổi server
node cli.js config set ntfy.server "https://ntfy.sh"
```

## 📁 Cấu trúc File

```
BrastelPin/
├── Data/                    # Dữ liệu theo access code
│   ├── 74974423/
│   │   ├── sent_pins_history.json
│   │   ├── blacklist_pins.json
│   │   └── valid_pins_found.json
│   └── 33849108/
│       ├── sent_pins_history.json
│       ├── blacklist_pins.json
│       └── valid_pins_found.json
├── Log/                     # File log
├── cli.js                   # Giao diện CLI
├── brastel-pin-checker.js   # Core logic
└── cli-config.json          # Cấu hình CLI
```

## 🔧 SSH Commands Cheatsheet

### Chạy ngầm với screen/tmux

```bash
# Sử dụng screen
screen -S brastel-checker
node cli.js start --workers 3
# Ctrl+A, D để detach

# Quay lại session
screen -r brastel-checker

# Sử dụng tmux
tmux new-session -d -s brastel-checker 'node cli.js start --workers 3'
tmux attach-session -t brastel-checker
```

### Chạy với nohup

```bash
# Chạy ngầm và ghi log
nohup node cli.js start --workers 3 > brastel.log 2>&1 &

# Xem log
tail -f brastel.log

# Kiểm tra process
ps aux | grep node
```

### Lệnh hữu ích

```bash
# Xem thống kê nhanh
node cli.js stats | grep "Valid PINs"

# Kiểm tra tiến độ
while true; do clear; node cli.js stats; sleep 10; done

# Backup dữ liệu
tar -czf backup-$(date +%Y%m%d).tar.gz Data/
```

## 🚨 Lưu ý quan trọng

1. **Chạy với quyền phù hợp**: Đảm bảo có quyền ghi file trong thư mục
2. **Kiểm tra dung lượng**: Theo dõi dung lượng ổ cứng khi chạy lâu dài
3. **Backup dữ liệu**: Thường xuyên backup thư mục `Data/`
4. **Giám sát log**: Theo dõi log để phát hiện lỗi sớm

## 🆘 Troubleshooting

### Lỗi thường gặp

```bash
# Kiểm tra version Node.js
node --version

# Cài đặt lại dependencies
rm -rf node_modules package-lock.json
npm install

# Kiểm tra quyền file
chmod +x cli.js

# Xem log lỗi chi tiết
node cli.js start 2>&1 | tee error.log
```

### Hiệu suất

- **Tối ưu workers**: Thường 3-5 workers cho performance tốt nhất
- **Delay phù hợp**: 100-200ms delay để tránh bị block
- **Giám sát memory**: Sử dụng `htop` hoặc `free -h`

## 📝 Logs

Logs được lưu trong thư mục `Log/` theo access code. Mỗi log file chứa:

- Thông tin PIN được kiểm tra
- Kết quả API responses
- Thông báo lỗi và warnings
- Thống kê hiệu suất

---

🎯 **Tối ưu cho SSH**: Ứng dụng được thiết kế đặc biệt để sử dụng hiệu quả qua SSH với giao diện CLI đầy đủ tính năng.