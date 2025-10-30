#!/usr/bin/env node

/**
 * 🔧 Debug & Fix Development Environment
 * ตรวจสอบและแก้ไขปัญหา environment configuration
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 === Debug Development Environment ===\n');

// 1. ตรวจสอบ .env.development
console.log('📁 ตรวจสอบ .env.development:');
try {
    const envContent = fs.readFileSync('.env.development', 'utf8');
    
    // ตรวจสอบ API URLs
    const apiUrls = envContent.match(/VITE_.*_URL="([^"]+)"/g);
    if (apiUrls) {
        console.log('🔗 API URLs ใน .env.development:');
        apiUrls.slice(0, 5).forEach(url => {
            const isProduction = url.includes('aa5gfxjdmq');
            const isDevelopment = url.includes('uwuxgoi2fa');
            const status = isProduction ? '❌ PRODUCTION' : isDevelopment ? '✅ DEVELOPMENT' : '❓ UNKNOWN';
            console.log(`   ${status}: ${url}`);
        });
    }
    
    // ตรวจสอบ Firebase Project
    const projectMatch = envContent.match(/VITE_FIREBASE_PROJECT_ID="([^"]+)"/);
    if (projectMatch) {
        const projectId = projectMatch[1];
        const status = projectId === 'work-permit-app-dev' ? '✅' : '❌';
        console.log(`\n🔥 Firebase Project: ${status} ${projectId}`);
    }
    
} catch (error) {
    console.log('❌ ไม่พบไฟล์ .env.development');
}

// 2. ตรวจสอบ dist directory
console.log('\n📦 ตรวจสอบ Build Output:');
const distPath = 'dist';
if (fs.existsSync(distPath)) {
    const stats = fs.statSync(distPath);
    console.log(`✅ พบ dist directory (แก้ไขล่าสุด: ${stats.mtime.toLocaleString()})`);
    
    // ตรวจสอบ built files
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        const indexContent = fs.readFileSync(indexPath, 'utf8');
        if (indexContent.includes('aa5gfxjdmq')) {
            console.log('❌ Built files ยังมี Production URLs!');
        } else if (indexContent.includes('uwuxgoi2fa')) {
            console.log('✅ Built files ใช้ Development URLs');
        } else {
            console.log('❓ ไม่พบ API URLs ใน built files');
        }
    }
} else {
    console.log('❌ ไม่พบ dist directory');
}

// 3. แนะนำการแก้ไข
console.log('\n🛠️ === แนะนำการแก้ไข ===');

console.log('\n🔄 ขั้นตอนแก้ไข:');
console.log('1. ลบ cache และ rebuild:');
console.log('   npm run clean-build');
console.log('');
console.log('2. Force rebuild แบบ development:');
console.log('   set NODE_ENV=development && npm run build');
console.log('');
console.log('3. Deploy ใหม่:');
console.log('   firebase deploy --project development');
console.log('');
console.log('4. Clear browser cache:');
console.log('   Ctrl+Shift+R หรือ Ctrl+F5');

// 4. สร้าง clean-build script
console.log('\n📝 สร้าง clean-build script...');
const packageJsonPath = 'package.json';
if (fs.existsSync(packageJsonPath)) {
    try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        
        if (!packageJson.scripts['clean-build']) {
            packageJson.scripts['clean-build'] = 'rm -rf dist node_modules/.vite && npm run build';
            fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
            console.log('✅ เพิ่ม clean-build script ใน package.json');
        }
    } catch (error) {
        console.log('⚠️ ไม่สามารถแก้ไข package.json');
    }
}

console.log('\n🎯 สำหรับ CORS บน localhost:');
console.log('   ใช้ dev site แทน: https://work-permit-app-dev.web.app');
console.log('   หรือตั้งค่า proxy ใน vite.config.js');
