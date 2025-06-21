const fs = require('fs');

// Đọc dữ liệu từ hai file
const list1 = JSON.parse(fs.readFileSync('file1.json', 'utf-8'));
const list2 = JSON.parse(fs.readFileSync('file2.json', 'utf-8'));

// Gộp hai mảng lại và loại trùng bằng Set
const merged = [...new Set([...list1, ...list2])];

// Ghi kết quả ra file mới
fs.writeFileSync('merged.json', JSON.stringify(merged, null, 2), 'utf-8');

console.log('✅ Đã merge xong! Kết quả lưu tại merged.json');
