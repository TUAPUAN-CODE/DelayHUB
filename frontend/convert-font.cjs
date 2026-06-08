const fs = require('fs');
const path = require('path');


console.log('เริ่มแปลงฟอนต์...');


try {
  // ตรวจสอบว่ามีไฟล์ฟอนต์หรือไม่
  if (!fs.existsSync('Sarabun-Regular.ttf')) {
    console.error('❌ ไม่พบไฟล์ Sarabun-Regular.ttf');
    console.log('กรุณาดาวน์โหลดฟอนต์จาก https://fonts.google.com/specimen/Sarabun');
    process.exit(1);
  }
 
  if (!fs.existsSync('Sarabun-Bold.ttf')) {
    console.error('❌ ไม่พบไฟล์ Sarabun-Bold.ttf');
    console.log('กรุณาดาวน์โหลดฟอนต์จาก https://fonts.google.com/specimen/Sarabun');
    process.exit(1);
  }
 
  // อ่านไฟล์ฟอนต์
  console.log('อ่านไฟล์ Sarabun-Regular.ttf...');
  const regularFont = fs.readFileSync('Sarabun-Regular.ttf');
 
  console.log('อ่านไฟล์ Sarabun-Bold.ttf...');
  const boldFont = fs.readFileSync('Sarabun-Bold.ttf');
 
  // แปลงเป็น base64
  console.log('แปลงเป็น base64...');
  const regularBase64 = regularFont.toString('base64');
  const boldBase64 = boldFont.toString('base64');
 
  console.log('✓ ความยาว Regular Base64:', regularBase64.length.toLocaleString(), 'ตัวอักษร');
  console.log('✓ ความยาว Bold Base64:', boldBase64.length.toLocaleString(), 'ตัวอักษร');
 
  // สร้างโฟลเดอร์
  const fontsDir = path.join('src', 'fonts');
  if (!fs.existsSync(fontsDir)) {
    fs.mkdirSync(fontsDir, { recursive: true });
    console.log('✓ สร้างโฟลเดอร์:', fontsDir);
  }
 
  // สร้างเนื้อหาไฟล์
  const regularContent = `// Auto-generated font file - Sarabun Regular
// Generated on: ${new Date().toLocaleString('th-TH')}
export const thSarabunBase64 = "${regularBase64}";
`;
 
  const boldContent = `// Auto-generated font file - Sarabun Bold
// Generated on: ${new Date().toLocaleString('th-TH')}
export const thSarabunBoldBase64 = "${boldBase64}";
`;
 
  // เขียนไฟล์
  console.log('กำลังเขียนไฟล์...');
  fs.writeFileSync(path.join(fontsDir, 'thSarabunBase64.js'), regularContent);
  fs.writeFileSync(path.join(fontsDir, 'thSarabunBoldBase64.js'), boldContent);
 
  console.log('\n🎉 แปลงฟอนต์สำเร็จ!');
  console.log('📁 ไฟล์ถูกสร้างที่:');
  console.log('   ✓', path.join(fontsDir, 'thSarabunBase64.js'));
  console.log('   ✓', path.join(fontsDir, 'thSarabunBoldBase64.js'));
  console.log('\n📝 ขั้นตอนถัดไป:');
  console.log('   1. Import ไฟล์ในโค้ด:');
  console.log('      import { thSarabunBase64 } from "../../../assets/fonts/thSarabunBase64";');
  console.log('      import { thSarabunBoldBase64 } from "../../../assets/fonts/thSarabunBoldBase64";');
  console.log('   2. ใช้งานใน jsPDF');
 
} catch (error) {
  console.error('\n❌ เกิดข้อผิดพลาด:', error.message);
  console.log('\n💡 แนะนำ:');
  console.log('   1. ตรวจสอบว่าไฟล์ฟอนต์อยู่ในโฟลเดอร์ frontend');
  console.log('   2. ตรวจสอบชื่อไฟล์ว่าถูกต้อง: Sarabun-Regular.ttf และ Sarabun-Bold.ttf');
  process.exit(1);
}



