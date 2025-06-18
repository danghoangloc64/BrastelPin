# Hướng Dẫn Cài Đặt Trên Multiple VPS

## Tổng Quan

Hệ thống Brastel PIN Checker có thể chạy trên nhiều VPS khác nhau để tăng hiệu suất và phân tán workload. Mỗi VPS sẽ chạy một server và khi tạo process mới, system sẽ tự động chia range PIN cho các server.

## Yêu Cầu

- 5 VPS (có thể ít hơn, điều chỉnh TOTAL_SERVERS)
- Node.js đã cài đặt trên tất cả VPS
- Các VPS có thể kết nối với nhau qua HTTP
- Port 3000 (hoặc port bạn chọn) mở trên tất cả VPS

## Bước 1: Chuẩn Bị

### 1.1. Copy Project

Copy toàn bộ project vào từng VPS:

```bash
# Trên mỗi VPS
git clone <your-repo-url>
cd BrastelPin
npm install
```

### 1.2. Ghi Chú IP Addresses

Lấy IP public của từng VPS:
- VPS 1: `192.168.1.10` (ví dụ)
- VPS 2: `192.168.1.11`
- VPS 3: `192.168.1.12`
- VPS 4: `192.168.1.13`
- VPS 5: `192.168.1.14`

## Bước 2: Cấu Hình Environment Variables

### 2.1. Tạo File .env

Trên mỗi VPS, tạo file `.env` với nội dung sau:

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
```

**VPS 2 (.env):**
```bash
SERVER_ID=2
TOTAL_SERVERS=5
PORT=3000
SERVER_1_ADDRESS=http://192.168.1.10:3000
SERVER_2_ADDRESS=http://192.168.1.11:3000
SERVER_3_ADDRESS=http://192.168.1.12:3000
SERVER_4_ADDRESS=http://192.168.1.13:3000
SERVER_5_ADDRESS=http://192.168.1.14:3000
```

**VPS 3, 4, 5:** Tương tự, chỉ thay đổi `SERVER_ID=3`, `SERVER_ID=4`, `SERVER_ID=5`

### 2.2. Load Environment Variables

Cài đặt dotenv nếu chưa có:

```bash
npm install dotenv
```

Thêm vào đầu file `web-gui.js`:

```javascript
require('dotenv').config();
```

## Bước 3: Khởi Chạy Servers

### 3.1. Khởi Chạy Từng Server

Trên mỗi VPS, chạy lệnh:

```bash
node start-servers.js
```

### 3.2. Kiểm Tra Kết Nối

Sau khi tất cả servers đã chạy, kiểm tra:

1. Truy cập `http://VPS1-IP:3000` - interface chính
2. Truy cập `http://VPS1-IP:3000/process-queue.html` - queue management
3. Kiểm tra log để đảm bảo servers có thể communicate với nhau

## Bước 4: Sử Dụng

### 4.1. Tạo Process Mới

1. Truy cập bất kỳ server nào qua web interface
2. Tạo process mới với:
   - Access Code: `74974423`
   - PIN Range: `0-9999`
   - Name: `Test Process`

### 4.2. Xem Phân Bổ

System sẽ tự động chia range cho 5 servers:
- Server 1: `0-1999`
- Server 2: `2000-3999`
- Server 3: `4000-5999`
- Server 4: `6000-7999`
- Server 5: `8000-9999`

### 4.3. Cross-Server Synchronization

Khi một server tìm được PIN hợp lệ:
1. Server đó sẽ gửi thông báo đến tất cả servers khác
2. Tất cả servers khác sẽ dừng process hiện tại
3. Tất cả servers sẽ chuyển sang process tiếp theo trong queue

## Bước 5: Monitoring & Troubleshooting

### 5.1. Kiểm Tra Status

Truy cập `/api/queue-status` trên bất kỳ server nào để xem trạng thái:

```bash
curl http://192.168.1.10:3000/api/queue-status
```

### 5.2. Xem Logs

Logs được lưu trong thư mục `Log/` trên mỗi server:

```bash
tail -f Log/log_74974423.txt
```

### 5.3. Common Issues

**Lỗi kết nối giữa servers:**
- Kiểm tra firewall/security groups
- Đảm bảo ports đã mở
- Kiểm tra IP addresses trong environment variables

**Server không nhận được processes:**
- Kiểm tra SERVER_ID và TOTAL_SERVERS
- Xem log khi tạo process
- Kiểm tra kết nối HTTP giữa servers

**Process bị stuck:**
- Restart server có process bị stuck
- Hoặc xóa process thông qua API

## Bước 6: Advanced Configuration

### 6.1. Custom Port

Để chạy trên port khác (ví dụ 8080):

```bash
# Trong .env
PORT=8080
SERVER_1_ADDRESS=http://192.168.1.10:8080
# ... các server khác tương tự
```

### 6.2. SSL/HTTPS

Để bảo mật kết nối, sử dụng HTTPS:

```bash
SERVER_1_ADDRESS=https://vps1.yourdomain.com:3000
# ... cần cấu hình SSL certificate
```

### 6.3. Load Balancer

Có thể đặt load balancer phía trước:

```bash
# Load balancer: 192.168.1.100
# Truy cập: http://192.168.1.100
# Load balancer forward đến các VPS backend
```

## Bước 7: Backup & Recovery

### 7.1. Backup Data

Định kỳ backup các file quan trọng:

```bash
# Backup script
tar -czf backup-$(date +%Y%m%d).tar.gz Data/ Log/ process_queue.json running_jobs_state.json
```

### 7.2. Recovery

Khi cần restore:

```bash
# Extract backup
tar -xzf backup-20240101.tar.gz

# Restart servers
node start-servers.js
```

## Script Tự Động

### Deploy Script (deploy.sh)

```bash
#!/bin/bash
# Script để deploy lên tất cả VPS

VPS_LIST=(
    "user@192.168.1.10"
    "user@192.168.1.11"
    "user@192.168.1.12"
    "user@192.168.1.13"
    "user@192.168.1.14"
)

for i in "${!VPS_LIST[@]}"; do
    VPS=${VPS_LIST[$i]}
    SERVER_ID=$((i + 1))

    echo "Deploying to VPS $SERVER_ID: $VPS"

    # Copy files
    rsync -avz ./ $VPS:~/BrastelPin/

    # Set environment
    ssh $VPS "cd ~/BrastelPin && echo 'SERVER_ID=$SERVER_ID' > .env"

    # Restart service
    ssh $VPS "cd ~/BrastelPin && pkill -f 'node.*web-gui' || true && nohup node start-servers.js > server.log 2>&1 &"
done
```

## Lưu Ý Quan Trọng

1. **Security:** Đảm bảo chỉ mở ports cần thiết
2. **Monitoring:** Setup monitoring để kiểm tra server health
3. **Backup:** Thường xuyên backup data và configuration
4. **Updates:** Update code đồng bộ trên tất cả servers
5. **Network:** Đảm bảo kết nối ổn định giữa các VPS