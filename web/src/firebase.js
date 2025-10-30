// 🔥 Environment-Aware Firebase Configuration
// ตรวจจับ environment และใช้ config ที่เหมาะสม

import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

// 🚀 Development Environment Config
const developmentConfig = {
  apiKey: "AIzaSyCfKD49ePWlW5zgHYOrArvju0vg_vRjj00",
  authDomain: "work-permit-app-dev.firebaseapp.com",
  projectId: "work-permit-app-dev",
  storageBucket: "work-permit-app-dev.firebasestorage.app",
  messagingSenderId: "620094360555",
  appId: "1:620094360555:web:2257e4d6cea30135f9e7ae",
  measurementId: "G-5FDDSR8LW6"
};

// 🏭 Production Environment Config
const productionConfig = {
  apiKey: "AIzaSyDOp1ThCGPjdKqAgCXiY4qZqeFtcnNWa6Q",
  authDomain: "work-permit-app-1e9f0.firebaseapp.com",
  projectId: "work-permit-app-1e9f0",
  storageBucket: "work-permit-app-1e9f0.firebasestorage.app",
  messagingSenderId: "532874719008",
  appId: "1:532874719008:web:ebf5d8fca58414ea747145",
  measurementId: "G-186H83JTMX"
};

// 🎯 Environment Detection & Config Selection
function getFirebaseConfig() {
  // วิธีที่ 1: ตรวจสอบจาก Vite environment
  const viteMode = import.meta.env.MODE;
  
  // วิธีที่ 2: ตรวจสอบจาก URL
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  
  // วิธีที่ 3: ตรวจสอบจาก environment variable
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  
  console.log('🔍 Environment Detection:');
  console.log('  - Vite Mode:', viteMode);
  console.log('  - Hostname:', hostname);
  console.log('  - Project ID:', projectId);
  
  // Logic การเลือก config
  let selectedConfig;
  let environmentName;
  
  if (
    viteMode === 'development' || 
    hostname.includes('work-permit-app-dev') ||
    projectId === 'work-permit-app-dev'
  ) {
    selectedConfig = developmentConfig;
    environmentName = 'DEVELOPMENT 🚀';
  } else {
    selectedConfig = productionConfig;
    environmentName = 'PRODUCTION 🏭';
  }
  
  console.log(`🔥 Firebase Environment: ${environmentName}`);
  console.log(`📋 Selected Project: ${selectedConfig.projectId}`);
  
  return selectedConfig;
}

// เลือก config ที่เหมาะสม
const firebaseConfig = getFirebaseConfig();

// Initialize Firebase
let app;
let analytics;

try {
  app = initializeApp(firebaseConfig);
  
  // เฉพาะใน browser environment และไม่ใช่ localhost
  if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
    analytics = getAnalytics(app);
  }
  
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization failed:', error);
}

// 🛠️ Utility Functions
export const getEnvironmentInfo = () => ({
  projectId: firebaseConfig.projectId,
  environment: firebaseConfig.projectId.includes('dev') ? 'development' : 'production',
  hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown'
});

export const isDevelopment = () => firebaseConfig.projectId === 'work-permit-app-dev';
export const isProduction = () => firebaseConfig.projectId === 'work-permit-app-1e9f0';

// Debug helper
export const debugFirebaseConfig = () => {
  console.table({
    'Project ID': firebaseConfig.projectId,
    'Auth Domain': firebaseConfig.authDomain,
    'Environment': isDevelopment() ? 'Development' : 'Production',
    'Storage Bucket': firebaseConfig.storageBucket
  });
};

export { app, analytics };
export default app;