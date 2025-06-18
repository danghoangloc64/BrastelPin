/**
 * Script để khởi chạy single server cho Brastel PIN Checker
 * Để chạy trên multiple VPS, copy toàn bộ project vào từng VPS và chạy script này
 */

const { spawn } = require('child_process');

// Đọc cấu hình từ environment variables
const SERVER_ID = parseInt(process.env.SERVER_ID) || 1;
const TOTAL_SERVERS = parseInt(process.env.TOTAL_SERVERS) || 5;
const PORT = parseInt(process.env.PORT) || 3000;

// Đọc địa chỉ các servers từ environment variables
const SERVER_ADDRESSES = [];
for (let i = 1; i <= TOTAL_SERVERS; i++) {
  const serverAddr = process.env[`SERVER_${i}_ADDRESS`];
  if (serverAddr) {
    SERVER_ADDRESSES.push(serverAddr);
  } else {
    // Default cho testing local
    SERVER_ADDRESSES.push(`http://localhost:${2999 + i}`);
  }
}

function startServer() {
  console.log('🔥 Starting Brastel PIN Checker Single Server');
  console.log(`🏭 Server ID: ${SERVER_ID}/${TOTAL_SERVERS}`);
  console.log(`🚀 Port: ${PORT}`);
  console.log(`🌐 Server Addresses: ${SERVER_ADDRESSES.join(', ')}`);
  console.log('==========================================');

  const env = {
    ...process.env,
    SERVER_ID: SERVER_ID.toString(),
    TOTAL_SERVERS: TOTAL_SERVERS.toString(),
    PORT: PORT.toString()
  };

  // Thêm server addresses vào environment
  for (let i = 0; i < SERVER_ADDRESSES.length; i++) {
    env[`SERVER_${i + 1}_ADDRESS`] = SERVER_ADDRESSES[i];
  }

  const serverProcess = spawn('node', ['web-gui.js'], {
    env,
    stdio: 'inherit',
    cwd: process.cwd()
  });

  serverProcess.on('close', (code) => {
    console.log(`🛑 Server process exited with code ${code}`);
  });

  serverProcess.on('error', (error) => {
    console.error(`❌ Failed to start server: ${error.message}`);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    serverProcess.kill('SIGTERM');
    setTimeout(() => {
      process.exit(0);
    }, 3000);
  });

  // Display access URLs after startup
  setTimeout(() => {
    console.log('\n✅ Server started successfully!');
    console.log('==========================================');
    console.log('🌐 Access URLs:');
    console.log(`   Main Interface: http://localhost:${PORT}`);
    console.log(`   Queue Manager: http://localhost:${PORT}/process-queue.html`);
    console.log('==========================================');
    console.log('💡 Setup Instructions:');
    console.log('   1. Copy this project to each VPS');
    console.log('   2. Set environment variables on each VPS:');
    console.log('      - SERVER_ID=1 (1,2,3,4,5 for each VPS)');
    console.log('      - TOTAL_SERVERS=5');
    console.log('      - PORT=3000 (or your preferred port)');
    console.log('      - SERVER_1_ADDRESS=http://vps1-ip:3000');
    console.log('      - SERVER_2_ADDRESS=http://vps2-ip:3000');
    console.log('      - SERVER_3_ADDRESS=http://vps3-ip:3000');
    console.log('      - SERVER_4_ADDRESS=http://vps4-ip:3000');
    console.log('      - SERVER_5_ADDRESS=http://vps5-ip:3000');
    console.log('   3. Run "node start-servers.js" on each VPS');
    console.log('   4. Create processes from any server - they will distribute automatically');
    console.log('   5. Use Ctrl+C to stop server');
    console.log('==========================================');
  }, 3000);

  return serverProcess;
}

// Start the server
startServer();