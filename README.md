# Brastel PIN Checker - SSH/CLI Version

🚀 **Brastel PIN Checker** với giao diện dòng lệnh (CLI) được tối ưu cho việc sử dụng qua SSH. Hỗ trợ kiểm tra PIN đa luồng với proxy rotation và concurrent workers.

## 🎯 Tính năng chính

- ✅ **Giao diện CLI hoàn chỉnh** - Dễ sử dụng qua SSH
- ✅ **Cấu hình từ file text** - Dễ dàng chỉnh sửa
- ✅ **Auto workers** - Số worker tự động dựa trên số cookies
- ✅ **PIN Range chung** - Cùng một range cho tất cả access codes
- ✅ **Fixed proxy** - Proxy cố định cho mỗi worker
- ✅ **Đa luồng (Multi-threading)** - Xử lý nhiều PIN cùng lúc
- ✅ **Hỗ trợ nhiều Access Code** - Kiểm tra nhiều tài khoản
- ✅ **Thông báo Ntfy** - Thông báo khi tìm thấy PIN hợp lệ
- ✅ **Lưu trữ dữ liệu** - Theo dõi tiến độ và kết quả

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

### 3. Chạy setup script (tùy chọn)
```bash
./start-ssh.sh
```

## ⚙️ Cấu hình từ File Text

### 📁 Các file cấu hình:

**1. `pinrange.txt`** - Cấu hình phạm vi PIN chung
```
1000
5000
```
- Dòng 1: PIN tối thiểu
- Dòng 2: PIN tối đa
- Phạm vi này áp dụng cho tất cả access codes

**2. `accesscodes.txt`** - Danh sách access codes
```
74974423
33849108
11111111
```
- Mỗi dòng là một access code
- Có thể có nhiều access codes

**3. `proxies.txt`** - Danh sách proxy (tùy chọn)
```
http://proxy1:port
http://proxy2:port

```
- Mỗi dòng là một proxy
- Dòng trống hoặc file trống = không dùng proxy
- Proxy được gán cố định cho worker

**4. `cookies.txt`** - Danh sách cookies
```
cookie_string_1
cookie_string_2
cookie_string_3
```
- Mỗi dòng là một cookie hoàn chỉnh
- Số lượng cookies = số lượng workers tự động
- Mỗi worker được gán một cookie cố định

## 🚀 Sử dụng qua SSH

### Các lệnh cơ bản

#### 1. Hiển thị trợ giúp
```bash
node cli.js help
```

#### 2. Bắt đầu kiểm tra PIN
```bash
# Chế độ cơ bản (auto workers từ cookies)
node cli.js start

# Với random processing
node cli.js start --random

# Với custom settings
node cli.js start --random --delay 200 --max-undefined 50
```

#### 3. Xem cấu hình hiện tại
```bash
node cli.js config
```

#### 4. Cập nhật cấu hình

**Cập nhật PIN Range:**
```bash
node cli.js config set pinrange "0-9999"
```

**Cập nhật Access Codes:**
```bash
node cli.js config set accesscodes "12345678,87654321"
```

**Cập nhật Proxies:**
```bash
# Thêm proxies
node cli.js config set proxies "proxy1:port,proxy2:port"

# Không dùng proxy
node cli.js config set proxies "none"
```

**Cập nhật Cookies:**
```bash
# Dùng ||| để phân tách cookies
node cli.js config set cookies "cookie1|||cookie2|||cookie3"
```

**Cài đặt khác:**
```bash
# Bật/tắt random processing
node cli.js config set randomProcessing.enabled true

# Thay đổi delay
node cli.js config set randomProcessing.delayBetweenPins 150

# Thay đổi max undefined
node cli.js config set maxUndefinedResults 30

# Cấu hình Ntfy
node cli.js config set ntfy.enabled true
node cli.js config set ntfy.topic "your-topic"
```

#### 5. Xem thống kê
```bash
# Thống kê tất cả access codes
node cli.js stats

# Thống kê cho access code cụ thể
node cli.js stats 74974423
```

### Tùy chọn cho lệnh `start`

| Tùy chọn | Mô tả | Ví dụ |
|----------|-------|-------|
| `--random` | Bật chế độ xử lý ngẫu nhiên | `--random` |
| `--max-undefined <số>` | Giới hạn kết quả undefined | `--max-undefined 50` |
| `--delay <ms>` | Thời gian delay giữa các PIN | `--delay 200` |

## 📊 Cách hoạt động Auto Workers

- **Số workers = Số cookies**: Nếu có 3 cookies → 3 workers
- **Fixed assignment**: Mỗi worker được gán:
  - 1 cookie cố định
  - 1 proxy cố định (nếu có)
- **Load balancing**: PINs được chia đều cho các workers

### Ví dụ với 3 cookies:
```
Worker 1: Cookie 1 + Proxy 1 (hoặc no proxy)
Worker 2: Cookie 2 + Proxy 2 (hoặc no proxy)
Worker 3: Cookie 3 + Proxy 3 (hoặc no proxy)
```

## 📁 Cấu trúc File

```
BrastelPin/
├── pinrange.txt            # ⚙️  PIN range chung
├── accesscodes.txt         # 🎯 Access codes
├── proxies.txt             # 🛡️  Danh sách proxy
├── cookies.txt             # 🍪 Danh sách cookies
├── Data/                   # 📊 Dữ liệu theo access code
│   ├── 74974423/
│   │   ├── sent_pins_history.json
│   │   ├── blacklist_pins.json
│   │   └── valid_pins_found.json
│   └── 33849108/
│       ├── sent_pins_history.json
│       ├── blacklist_pins.json
│       └── valid_pins_found.json
├── Log/                    # 📝 File log
├── cli.js                  # 🔧 Giao diện CLI
├── brastel-pin-checker.js  # ⚡ Core logic
└── start-ssh.sh           # 🚀 Startup script
```

## 🔧 SSH Commands Cheatsheet

### Chạy ngầm với screen/tmux

```bash
# Sử dụng screen
screen -S brastel-checker
node cli.js start --random
# Ctrl+A, D để detach

# Quay lại session
screen -r brastel-checker

# Sử dụng tmux
tmux new-session -d -s brastel-checker 'node cli.js start --random'
tmux attach-session -t brastel-checker
```

### Chạy với nohup

```bash
# Chạy ngầm và ghi log
nohup node cli.js start --random > brastel.log 2>&1 &

# Xem log
tail -f brastel.log

# Kiểm tra process
ps aux | grep node
```

### Quản lý cấu hình nhanh

```bash
# Xem config hiện tại
node cli.js config

# Thay đổi PIN range
node cli.js config set pinrange "5000-9999"

# Thêm access code mới
node cli.js config set accesscodes "12345,67890,11111"

# Kiểm tra stats
node cli.js stats

# Backup config
tar -czf config-backup-$(date +%Y%m%d).tar.gz *.txt
```

### Lệnh hữu ích

```bash
# Xem thống kê nhanh
node cli.js stats | grep "Valid PINs"

# Kiểm tra tiến độ
while true; do clear; node cli.js stats; sleep 10; done

# Backup dữ liệu
tar -czf backup-$(date +%Y%m%d).tar.gz Data/

# Xem workers info
node cli.js config | grep "Concurrent Workers"
```

## 🚨 Lưu ý quan trọng

1. **Auto Workers**: Số worker tự động = số cookies, không cần cài đặt thủ công
2. **Fixed Proxy**: Mỗi worker dùng proxy cố định, không rotate
3. **PIN Range chung**: Tất cả access codes dùng chung một PIN range
4. **File config**: Thay đổi file config cần restart ứng dụng
5. **Backup config**: Thường xuyên backup các file .txt

## 🆘 Troubleshooting

### Lỗi thường gặp

```bash
# Kiểm tra version Node.js
node --version

# Cài đặt lại dependencies
rm -rf node_modules package-lock.json
npm install

# Kiểm tra file config
ls -la *.txt
cat pinrange.txt

# Xem log lỗi chi tiết
node cli.js config 2>&1 | tee error.log
```

### Hiệu suất

- **Tối ưu cookies**: 3-5 cookies cho performance tốt nhất
- **Delay phù hợp**: 100-200ms delay để tránh bị block
- **Proxy phân tán**: Dùng proxy khác nhau cho mỗi worker
- **Giám sát memory**: Sử dụng `htop` hoặc `free -h`

### Cấu hình mẫu

**Cấu hình cơ bản (3 workers):**
```bash
# pinrange.txt
echo -e "0\n9999" > pinrange.txt

# accesscodes.txt
echo -e "12345678\n87654321" > accesscodes.txt

# cookies.txt (3 cookies = 3 workers)
echo -e "cookie1\ncookie2\ncookie3" > cookies.txt

# proxies.txt (không dùng proxy)
touch proxies.txt
```

## 📝 Logs

Logs được lưu trong thư mục `Log/` theo access code. Mỗi log file chứa:

- Thông tin PIN được kiểm tra
- Kết quả API responses
- Thông báo lỗi và warnings
- Thống kê hiệu suất worker

---

🎯 **Tối ưu cho SSH**: Ứng dụng được thiết kế đặc biệt để sử dụng hiệu quả qua SSH với hệ thống cấu hình file text linh hoạt và auto workers dựa trên cookies.