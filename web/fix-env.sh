#!/bin/bash

# 🚀 Work Permit App - Environment Deployment Script
# ใช้สำหรับ deploy ไปยัง environment ต่างๆ อย่างถูกต้อง

set -e  # Exit on any error

# สี Terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ฟังก์ชันสำหรับ print สี
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ตรวจสอบ environment parameter
ENVIRONMENT=$1

if [ -z "$ENVIRONMENT" ]; then
    print_error "กรุณาระบุ environment: development หรือ production"
    echo "Usage: $0 {development|production}"
    exit 1
fi

# ตั้งค่า variables ตาม environment
case $ENVIRONMENT in
    "development"|"dev")
        ENVIRONMENT="development"
        PROJECT_ID="work-permit-app-dev"
        FIREBASE_PROJECT="development"
        ENV_FILE=".env.development"
        EXPECTED_API_ID="uwuxgoi2fa"
        SITE_URL="https://work-permit-app-dev.web.app"
        ;;
    "production"|"prod")
        ENVIRONMENT="production"
        PROJECT_ID="work-permit-app-1e9f0"
        FIREBASE_PROJECT="work-permit-app-1e9f0"
        ENV_FILE=".env.production"
        EXPECTED_API_ID="aa5gfxjdmq"
        SITE_URL="https://imperialworld.asia"
        ;;
    *)
        print_error "Environment ไม่ถูกต้อง: $ENVIRONMENT"
        echo "ใช้ได้เฉพาะ: development หรือ production"
        exit 1
        ;;
esac

print_status "🚀 เริ่ม deployment สำหรับ environment: $ENVIRONMENT"
print_status "📋 Project ID: $PROJECT_ID"
print_status "🔗 Site URL: $SITE_URL"

# เปลี่ยนไปยัง web directory
cd web

# ตรวจสอบว่ามี env file หรือไม่
if [ ! -f "$ENV_FILE" ]; then
    print_error "ไม่พบไฟล์ $ENV_FILE"
    exit 1
fi

print_success "✅ พบไฟล์ $ENV_FILE"

# ตรวจสอบว่า API URLs ถูกต้องหรือไม่
print_status "🔍 ตรวจสอบ API configuration..."

API_ID_COUNT=$(grep -c "$EXPECTED_API_ID" "$ENV_FILE" || true)
if [ "$API_ID_COUNT" -eq 0 ]; then
    print_error "API URLs ใน $ENV_FILE ไม่ถูกต้อง"
    print_error "คาดหวัง API ID: $EXPECTED_API_ID"
    
    # แสดง API URLs ปัจจุบัน
    print_warning "API URLs ปัจจุบัน:"
    grep "VITE_.*_URL=" "$ENV_FILE" | head -3
    
    # เสนอการแก้ไขอัตโนมัติ
    read -p "ต้องการแก้ไข API URLs อัตโนมัติหรือไม่? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "🔧 กำลังแก้ไข API URLs..."
        
        # สำรองไฟล์เดิม
        cp "$ENV_FILE" "${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
        
        if [ "$ENVIRONMENT" = "development" ]; then
            # แทนที่ production URLs ด้วย development URLs
            sed -i 's/aa5gfxjdmq/uwuxgoi2fa/g' "$ENV_FILE"
        else
            # แทนที่ development URLs ด้วย production URLs  
            sed -i 's/uwuxgoi2fa/aa5gfxjdmq/g' "$ENV_FILE"
        fi
        
        print_success "✅ แก้ไข API URLs เรียบร้อย"
    else
        print_error "กรุณาแก้ไข $ENV_FILE ให้ถูกต้องก่อน deploy"
        exit 1
    fi
fi

print_success "✅ API configuration ถูกต้อง ($API_ID_COUNT URLs)"

# ตรวจสอบ Firebase project
print_status "🔍 ตรวจสอบ Firebase project configuration..."

PROJECT_IN_ENV=$(grep "VITE_FIREBASE_PROJECT_ID=" "$ENV_FILE" | cut -d'"' -f2)
if [ "$PROJECT_IN_ENV" != "$PROJECT_ID" ]; then
    print_error "Firebase Project ID ใน $ENV_FILE ไม่ตรงกับ environment"
    print_error "คาดหวัง: $PROJECT_ID, พบ: $PROJECT_IN_ENV"
    exit 1
fi

print_success "✅ Firebase project configuration ถูกต้อง"

# Build application
print_status "🔨 Building application สำหรับ $ENVIRONMENT..."

export NODE_ENV=$ENVIRONMENT
npm run build

if [ $? -ne 0 ]; then
    print_error "Build failed"
    exit 1
fi

print_success "✅ Build สำเร็จ"

# กลับไปยัง root directory สำหรับ Firebase deploy
cd ..

# Deploy to Firebase
print_status "🚀 Deploying to Firebase ($FIREBASE_PROJECT)..."

firebase deploy --project "$FIREBASE_PROJECT"

if [ $? -ne 0 ]; then
    print_error "Firebase deployment failed"
    exit 1
fi

print_success "🎉 Deployment สำเร็จ!"
print_status "🔗 Site URL: $SITE_URL"

# ทดสอบ connection
print_status "🧪 ทดสอบ site connectivity..."

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL" || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
    print_success "✅ Site พร้อมใช้งาน (HTTP $HTTP_STATUS)"
else
    print_warning "⚠️ Site response: HTTP $HTTP_STATUS"
fi

# แสดงข้อมูลสรุป
echo
echo "📊 === สรุปการ Deploy ==="
echo "Environment: $ENVIRONMENT"
echo "Project ID: $PROJECT_ID"
echo "Site URL: $SITE_URL"
echo "API ID: $EXPECTED_API_ID"
echo "Deploy Time: $(date)"
echo

print_success "🎯 Deployment เสร็จสมบูรณ์!"