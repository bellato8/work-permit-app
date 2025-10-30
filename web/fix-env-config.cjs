#!/usr/bin/env node

/**
 * 🤖 AI Script: Fix Environment Configuration (CommonJS Version)
 * ตรวจสอบและแก้ไข Firebase environment configuration
 */

const fs = require('fs');
const path = require('path');

class EnvConfigAnalyzer {
    constructor() {
        this.issues = [];
        this.fixes = [];
    }

    // ตรวจสอบ Firebase config ใน source code
    analyzeFirebaseConfig(filePath) {
        console.log('🔍 กำลังตรวจสอบ Firebase Config...');
        
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const projectIdMatch = content.match(/projectId:\s*["']([^"']+)["']/);
            
            if (projectIdMatch) {
                const projectId = projectIdMatch[1];
                console.log(`📋 พบ Project ID: ${projectId}`);
                
                if (projectId === 'work-permit-app-1e9f0') {
                    this.issues.push('❌ Firebase config ยังเป็น Production');
                    this.fixes.push('แก้ไข: สร้าง environment-specific config');
                }
            }
        } catch (error) {
            console.log(`⚠️ ไม่สามารถอ่านไฟล์ ${filePath}: ${error.message}`);
        }
    }

    // ตรวจสอบ .env files
    analyzeEnvFiles(webDir) {
        console.log('🔍 กำลังตรวจสอบ Environment Files...');
        
        const envFiles = [
            '.env.local',
            '.env.development', 
            '.env.production'
        ];

        envFiles.forEach(envFile => {
            const envPath = path.join(webDir, envFile);
            
            if (fs.existsSync(envPath)) {
                console.log(`📁 ตรวจสอบ ${envFile}...`);
                const content = fs.readFileSync(envPath, 'utf8');
                
                // ตรวจสอบ Firebase Project ID
                const projectMatch = content.match(/VITE_FIREBASE_PROJECT_ID="([^"]+)"/);
                if (projectMatch) {
                    console.log(`   📋 Project ID: ${projectMatch[1]}`);
                }

                // ตรวจสอบ API URLs
                const apiUrls = content.match(/VITE_.*_URL="([^"]+)"/g);
                if (apiUrls) {
                    const uniqueIds = new Set();
                    apiUrls.forEach(url => {
                        const idMatch = url.match(/https:\/\/\w+-(\w+)-\w+\.a\.run\.app/);
                        if (idMatch) uniqueIds.add(idMatch[1]);
                    });
                    
                    console.log(`   🔗 API ID(s): ${Array.from(uniqueIds).join(', ')}`);
                    
                    if (envFile === '.env.development' && uniqueIds.has('aa5gfxjdmq')) {
                        this.issues.push('❌ Dev environment ใช้ Production API URLs');
                        this.fixes.push('แก้ไข: เปลี่ยน URLs เป็น uwuxgoi2fa (Dev)');
                    }
                }
            } else {
                console.log(`⚠️ ไม่พบไฟล์ ${envFile}`);
            }
        });
    }

    // สร้าง PowerShell Fix Script สำหรับ Windows
    generateWindowsFixScript(webDir) {
        console.log('\n🛠️ กำลังสร้าง PowerShell Fix Script...');
        
        const fixScript = `# 🤖 Auto-generated PowerShell Fix Script
Write-Host "🔧 กำลังแก้ไข Environment Configuration..." -ForegroundColor Blue

# 1. สำรองไฟล์เดิม
Write-Host "📝 สำรองไฟล์เดิม..." -ForegroundColor Yellow
Copy-Item .env.development .env.development.backup

# 2. แก้ไข Development URLs
Write-Host "🔄 อัปเดต Development API URLs..." -ForegroundColor Yellow

# แทนที่ Production URLs (aa5gfxjdmq) ด้วย Development URLs (uwuxgoi2fa)
$content = Get-Content .env.development -Raw
$newContent = $content -replace 'aa5gfxjdmq', 'uwuxgoi2fa'
Set-Content .env.development $newContent

# 3. ตรวจสอบผลลัพธ์
Write-Host "✅ เสร็จสิ้น! ตรวจสอบการเปลี่ยนแปลง:" -ForegroundColor Green
Select-String "uwuxgoi2fa" .env.development | Select-Object -First 5

Write-Host ""
Write-Host "🚀 ขั้นตอนถัดไป:" -ForegroundColor Cyan
Write-Host "1. ตรวจสอบไฟล์ .env.development"
Write-Host "2. เรียกใช้: npm run build"
Write-Host "3. Deploy: firebase deploy --project development"
`;

        const fixScriptPath = path.join(webDir, 'fix-env.ps1');
        fs.writeFileSync(fixScriptPath, fixScript);
        
        console.log(`✅ สร้าง PowerShell Fix Script: ${fixScriptPath}`);
    }

    // รายงานผลการวิเคราะห์
    generateReport() {
        console.log('\n📊 === รายงานการวิเคราะห์ ===');
        
        if (this.issues.length > 0) {
            console.log('\n❌ ปัญหาที่พบ:');
            this.issues.forEach(issue => console.log(`   ${issue}`));
        }
        
        if (this.fixes.length > 0) {
            console.log('\n🛠️ วิธีแก้ไข:');
            this.fixes.forEach(fix => console.log(`   ${fix}`));
        }
        
        console.log('\n🚀 ขั้นตอนการแก้ไข:');
        console.log('   1. รัน ./fix-env.ps1 ใน web directory (PowerShell)');
        console.log('   2. อัปเดต firebase config ใน source code');
        console.log('   3. Build และ Deploy ใหม่');
        console.log('   4. ตรวจสอบ CORS settings ใน Cloud Functions');
    }

    // เรียกใช้การวิเคราะห์ทั้งหมด
    async run(webDir = './web', srcDir = './web/src') {
        console.log('🤖 เริ่มการวิเคราะห์ Environment Configuration...\n');
        
        // วิเคราะห์ Firebase config
        const firebaseConfigPath = path.join(srcDir, 'firebase.js');
        if (fs.existsSync(firebaseConfigPath)) {
            this.analyzeFirebaseConfig(firebaseConfigPath);
        }
        
        // วิเคราะห์ .env files
        this.analyzeEnvFiles(webDir);
        
        // สร้าง PowerShell Fix Script สำหรับ Windows
        this.generateWindowsFixScript(webDir);
        
        // รายงานผล
        this.generateReport();
    }
}

// รันการวิเคราะห์
if (require.main === module) {
    const analyzer = new EnvConfigAnalyzer();
    
    // รับ path จาก command line argument หรือใช้ default
    const webDir = process.argv[2] || './web';
    const srcDir = process.argv[3] || './web/src';
    
    analyzer.run(webDir, srcDir).catch(console.error);
}

module.exports = EnvConfigAnalyzer;
