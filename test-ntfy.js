/**
 * Test script for NTFY notifications
 * Usage: node test-ntfy.js
 */

require('dotenv').config();
const { NtfyNotifier } = require('./brastel-pin-checker');

async function testNtfyNotifications() {
  console.log('🧪 Testing NTFY Notifications');
  console.log('=============================');

  // Hiển thị cấu hình NTFY hiện tại
  console.log('📋 Current NTFY Configuration:');
  console.log(`   Topic: ${process.env.NTFY_TOPIC || 'dhloc (default)'}`);
  console.log(`   Server: ${process.env.NTFY_SERVER || 'https://ntfy.sh (default)'}`);
  console.log(`   Title: ${process.env.NTFY_TITLE || 'Brastel PIN Checker (default)'}`);
  console.log('');

  if (!process.env.NTFY_TOPIC) {
    console.log('⚠️  NTFY_TOPIC not configured in .env file');
    console.log('💡 Create .env file with NTFY_TOPIC=your-topic to enable notifications');
    console.log('');
  }

  // Tạo NtfyNotifier instance
  const notifier = new NtfyNotifier();

  console.log('🧪 Test 1: PIN Found Notification');
  console.log('----------------------------------');
  try {
    await notifier.sendPinFoundNotification('33849108', '1234', '1');
    console.log('✅ Test 1 completed (check your NTFY app/web)');
  } catch (error) {
    console.log('❌ Test 1 failed:', error.message);
  }
  console.log('');

  // Delay giữa các test
  await delay(2000);

  console.log('🧪 Test 2: Process Completion (Success)');
  console.log('---------------------------------------');
  try {
    await notifier.sendProcessCompleteNotification(
      'Test Process Server 1',
      '33849108',
      '5678',
      '1'
    );
    console.log('✅ Test 2 completed (check your NTFY app/web)');
  } catch (error) {
    console.log('❌ Test 2 failed:', error.message);
  }
  console.log('');

  // Delay giữa các test
  await delay(2000);

  console.log('🧪 Test 3: Process Completion (No PIN Found)');
  console.log('---------------------------------------------');
  try {
    await notifier.sendProcessCompleteNotification(
      'Test Process Server 2',
      '74974423',
      null,
      '2'
    );
    console.log('✅ Test 3 completed (check your NTFY app/web)');
  } catch (error) {
    console.log('❌ Test 3 failed:', error.message);
  }
  console.log('');

  // Delay giữa các test
  await delay(2000);

  console.log('🧪 Test 4: Multiple Access Codes');
  console.log('---------------------------------');
  const accessCodes = ['11111111', '22222222', '33333333'];
  for (let i = 0; i < accessCodes.length; i++) {
    try {
      await notifier.sendPinFoundNotification(
        accessCodes[i],
        String(1000 + i).padStart(4, '0'),
        String(i + 1)
      );
      console.log(`   ✅ Sent notification for access code ${accessCodes[i]}`);
      await delay(1000); // Delay nhỏ giữa các notification
    } catch (error) {
      console.log(`   ❌ Failed for access code ${accessCodes[i]}:`, error.message);
    }
  }
  console.log('✅ Test 4 completed');
  console.log('');

  console.log('🧪 Test 5: Invalid Configuration Test');
  console.log('-------------------------------------');
  try {
    // Tạo notifier với config không hợp lệ
    const invalidNotifier = new NtfyNotifier();
    invalidNotifier.ntfyTopic = ''; // Empty topic

    await invalidNotifier.sendPinFoundNotification('12345678', '9999', '1');
    console.log('✅ Test 5 completed (should skip sending)');
  } catch (error) {
    console.log('❌ Test 5 failed:', error.message);
  }
  console.log('');

  console.log('🧪 Test 6: Long Message Test');
  console.log('-----------------------------');
  try {
    const longAccessCode = '99999999';
    const longPin = '8888';

    await notifier.sendPinFoundNotification(longAccessCode, longPin, '999');
    console.log('✅ Test 6 completed');
  } catch (error) {
    console.log('❌ Test 6 failed:', error.message);
  }
  console.log('');

  console.log('🎉 All NTFY tests completed!');
  console.log('============================');
  console.log('');

  console.log('📱 How to check results:');
  console.log(`   1. Mobile App: Open NTFY app and check topic "${process.env.NTFY_TOPIC || 'dhloc'}"`);
  console.log(`   2. Web Browser: Visit ${process.env.NTFY_SERVER || 'https://ntfy.sh'}/${process.env.NTFY_TOPIC || 'dhloc'}`);
  console.log(`   3. Command Line: curl -s ${process.env.NTFY_SERVER || 'https://ntfy.sh'}/${process.env.NTFY_TOPIC || 'dhloc'}/json`);
  console.log('');

  console.log('💡 Tips:');
  console.log('   - If no notifications received, check your NTFY_TOPIC configuration');
  console.log('   - Make sure you have subscribed to the topic in NTFY app');
  console.log('   - Check internet connection if notifications fail');
  console.log('   - For private topics, verify NTFY server and authentication');
}

// Helper function for delays
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Chạy test với error handling
async function runTests() {
  try {
    await testNtfyNotifications();
  } catch (error) {
    console.error('💥 Test suite failed:', error.message);
    process.exit(1);
  }
}

// Kiểm tra nếu file được chạy trực tiếp
if (require.main === module) {
  console.log('🚀 Starting NTFY Test Suite...');
  console.log('');

  runTests().then(() => {
    console.log('🏁 Test suite finished successfully');
    process.exit(0);
  });
}

module.exports = {
  testNtfyNotifications,
  delay
};