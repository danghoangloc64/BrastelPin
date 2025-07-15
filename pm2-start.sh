#!/bin/bash
pm2 stop 0
# Đường dẫn đến file Node.js
SCRIPT="cli.js"

# Tham số truyền vào script Node (mặc định là "start")
ARGS=${1:-start}

# Chạy với PM2, không autorestart, truyền đối số cho script
pm2 start "$SCRIPT" \
  --no-autorestart \
  -- "$ARGS"
