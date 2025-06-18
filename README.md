# Brastel PIN Checker - Hệ thống Kiểm tra PIN Đa Máy Chủ

Hệ thống kiểm tra PIN Brastel tự động với khả năng chạy trên nhiều VPS, phân tán workload và đồng bộ hóa giữa các máy chủ.

## 🌟 Tính năng chính

- **Multi-Server Distribution**: Tự động chia range PIN cho nhiều VPS
- **Cross-Server Synchronization**: Đồng bộ hóa khi tìm thấy PIN hợp lệ
- **Process Queue Management**: Quản lý hàng đợi tiến trình tự động
- **Web GUI Interface**: Giao diện web hiện đại và thân thiện
- **Real-time Monitoring**: Theo dõi tiến trình thời gian thực
- **Environment Configuration**: Cấu hình linh hoạt qua file .env
- **Proxy Support**: Hỗ trợ proxy và rotation
- **Blacklist Management**: Quản lý danh sách PIN không hợp lệ

## 🏗️ Kiến trúc hệ thống

```
VPS 1 (Server 1)    VPS 2 (Server 2)    VPS 3 (Server 3)
    ↓                     ↓                     ↓
Range: 0-1999        Range: 2000-3999     Range: 4000-5999
    ↓                     ↓                     ↓
        HTTP Communication & Synchronization
```

## 📋 Yêu cầu hệ thống

- Node.js 16+
- NPM hoặc Yarn
- 5 VPS (có thể ít hơn, điều chỉnh TOTAL_SERVERS)
- Các VPS có thể kết nối với nhau qua HTTP
- Port 3000 (hoặc port tùy chọn) mở trên tất cả VPS

## 🚀 Cài đặt và Thiết lập

### 1. Cài đặt trên mỗi VPS

```bash
# Clone project
git clone <your-repo-url>
cd BrastelPin
npm install
```

### 2. Cấu hình Environment Variables

Tạo file `.env` trên mỗi VPS với nội dung khác nhau:

**VPS 1 (.env):**
```bash
SERVER_ID=1
TOTAL_SERVERS=5
PORT=3000
SERVER_1_ADDRESS=http://192.168.1.10:3000
SERVER_2_ADDRESS=http://192.168.1.11:3000
SERVER_3_ADDRESS=http://192.168.1.12:3000
SERVER_4_ADDRESS=http://192.168.1.13:3000
SERVER_5_ADDRESS=http://192.168.1.14:3000

# PIN Checker Configuration
CONCURRENT_WORKERS=1
MAX_RETRIES=10
RETRY_DELAY=3000
RANDOM_PROCESSING=true
DELAY_BETWEEN_PINS=100
```

**VPS 2, 3, 4, 5:** Tương tự, chỉ thay đổi `SERVER_ID=2`, `SERVER_ID=3`, v.v.

### 3. Khởi chạy

Trên mỗi VPS:
```bash
node start-servers.js
```

## 🎯 Cách sử dụng

### Web Interface

1. Truy cập bất kỳ server nào: `http://vps-ip:3000`
2. Sử dụng Process Queue Manager: `http://vps-ip:3000/process-queue.html`

### Tạo Process mới

1. Điền thông tin Access Code và PIN Range
2. Hệ thống sẽ tự động chia range cho tất cả server
3. Các server bắt đầu xử lý đồng thời
4. Khi server nào tìm thấy PIN hợp lệ, tất cả server khác dừng và chuyển sang process tiếp theo

### Command Line

```bash
# Chạy trực tiếp PIN checker
npm start

# Chạy Web GUI
npm run gui

# Lint code
npm run lint
```

## 📁 Cấu trúc dự án

```
BrastelPin/
├── brastel-pin-checker.js      # Core PIN checking logic
├── web-gui.js                  # Web server và API
├── process-queue-manager.js    # Quản lý hàng đợi tiến trình
├── start-servers.js           # Script khởi chạy server
├── deploy-vps.sh              # Script deploy tự động
├── .env                       # Environment variables
├── env.example               # Mẫu cấu hình .env
├── package.json              # Dependencies
├── public/                   # Web assets
│   ├── index.html           # Giao diện chính
│   └── process-queue.html   # Quản lý queue
├── Data/                    # Dữ liệu PIN
│   └── {accessCode}/
│       ├── sent_pins_history.json
│       ├── blacklist_pins.json
│       └── valid_pins_found.json
└── Log/                     # Log files
    └── log_{accessCode}.txt
```

## ⚙️ Cấu hình nâng cao

### Environment Variables

| Variable | Mô tả | Default |
|----------|-------|---------|
| `SERVER_ID` | ID của server hiện tại | 1 |
| `TOTAL_SERVERS` | Tổng số server | 5 |
| `PORT` | Port chạy web server | 3000 |
| `SERVER_X_ADDRESS` | Địa chỉ server X | localhost:300X |
| `CONCURRENT_WORKERS` | Số worker đồng thời | 1 |
| `MAX_RETRIES` | Số lần thử lại tối đa | 10 |
| `RETRY_DELAY` | Thời gian chờ giữa các lần thử | 3000ms |
| `RANDOM_PROCESSING` | Chế độ xử lý ngẫu nhiên | true |
| `DELAY_BETWEEN_PINS` | Thời gian chờ giữa các PIN | 100ms |

### Proxy Configuration

```bash
# Trong .env
PROXY_LIST=http://proxy1:port,http://proxy2:port,http://proxy3:port
```

### Cookie Configuration

```bash
# Trong .env
COOKIE_LIST=cookie1|cookie2|cookie3
```

## 🔧 Deployment tự động

### Sử dụng script deploy

1. Cập nhật danh sách VPS trong `deploy-vps.sh`:
```bash
VPS_LIST=(
    "user@192.168.1.10"
    "user@192.168.1.11"
    "user@192.168.1.12"
    "user@192.168.1.13"
    "user@192.168.1.14"
)
```

2. Chạy script:
```bash
chmod +x deploy-vps.sh
./deploy-vps.sh
```

### Manual deployment

```bash
# Copy files to VPS
rsync -avz ./ user@vps-ip:~/BrastelPin/

# SSH to VPS and start
ssh user@vps-ip
cd ~/BrastelPin
npm install
node start-servers.js
```

## 🎮 API Documentation

### Process Management

| Endpoint | Method | Mô tả |
|----------|--------|-------|
| `/api/queue-status` | GET | Lấy trạng thái queue |
| `/api/add-process` | POST | Thêm process mới |
| `/api/start-process` | POST | Bắt đầu process |
| `/api/stop-process` | POST | Dừng process |
| `/api/delete-process/:id` | DELETE | Xóa process |

### PIN Checking

| Endpoint | Method | Mô tả |
|----------|--------|-------|
| `/api/check-pin` | POST | Kiểm tra PIN đơn lẻ |
| `/api/get-statistics/:accessCode` | GET | Lấy thống kê |
| `/api/blacklist-pin` | POST | Thêm PIN vào blacklist |

## 📊 Monitoring & Logging

### Log Files

- **Server logs**: `server.log` (trên mỗi VPS)
- **PIN checking logs**: `Log/log_{accessCode}.txt`

### Health Check

```bash
# Kiểm tra server status
curl http://vps-ip:3000/api/queue-status

# Kiểm tra process đang chạy
ps aux | grep "node.*web-gui"
```

### Statistics

- Truy cập web interface để xem thống kê real-time
- Số PIN đã gửi, blacklist, valid PINs
- Tiến độ xử lý của từng server

## 🛠️ Troubleshooting

### Server không kết nối được

1. Kiểm tra firewall và port
```bash
sudo ufw status
netstat -tulpn | grep :3000
```

2. Kiểm tra server logs
```bash
tail -f ~/BrastelPin/server.log
```

### Process không chạy

1. Kiểm tra environment variables
```bash
env | grep SERVER_
```

2. Kiểm tra queue status
```bash
curl http://localhost:3000/api/queue-status
```

### Đồng bộ hóa bị lỗi

1. Restart tất cả servers
2. Kiểm tra network connectivity giữa các VPS
3. Xem log để tìm lỗi HTTP communication

## 🔒 Security

### Network Security

- Chỉ mở ports cần thiết (3000)
- Sử dụng VPN hoặc private network giữa các VPS
- Cấu hình firewall phù hợp

### Data Security

- Backup định kỳ folder `Data/` và `Log/`
- Không commit file `.env` vào git
- Sử dụng HTTPS nếu có thể

## 📖 Examples

### Tạo process qua API

```javascript
const response = await fetch('http://vps1:3000/api/add-process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    process: {
      name: 'Test Process',
      accessCode: '74974423',
      pinRange: { start: 0, end: 9999 },
      settings: { concurrentWorkers: 1 }
    }
  })
});
```

### Kiểm tra statistics

```bash
curl http://vps1:3000/api/get-statistics/74974423
```

## 🔄 Updates & Maintenance

### Cập nhật code

```bash
# Trên mỗi VPS
git pull
npm install
# Restart server
pkill -f "node.*web-gui"
node start-servers.js
```

### Backup

```bash
# Script backup tự động
tar -czf backup-$(date +%Y%m%d).tar.gz Data/ Log/ process_queue.json running_jobs_state.json .env
```

## 🤝 Contributing

1. Fork repository
2. Tạo feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📄 License

ISC License - Xem file LICENSE để biết thêm chi tiết.

## 🆘 Support

- Tạo issue trên GitHub để báo lỗi
- Kiểm tra logs và troubleshooting guide trước khi báo lỗi
- Cung cấp thông tin chi tiết: OS, Node.js version, error logs

---

**Made with ❤️ for efficient PIN checking across multiple servers**