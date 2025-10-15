// ======================================================================
// File: scripts/migrate-permissions.ts
// Purpose: Script สำหรับ Migrate ข้อมูล Admin เก่าให้มี pagePermissions
// Usage: npx ts-node scripts/migrate-permissions.ts [--dry-run]
// Created: 2025-10-14
// ======================================================================

import * as admin from 'firebase-admin';
import * as readline from 'readline';

// Import types (adjust path ตามโครงสร้างจริง)
// Note: ถ้า import จาก web/src ไม่ได้ ให้คัดลอก function มาใส่ตรงนี้แทน
type PagePermissions = {
  dashboard: { canView: boolean };
  approvals: {
    canView: boolean;
    canViewDetails: boolean;
    canApprove: boolean;
    canReject: boolean;
    canExport: boolean;
  };
  permits: {
    canView: boolean;
    canViewDetails: boolean;
    canExport: boolean;
  };
  dailyWork: {
    canView: boolean;
    canCheckIn: boolean;
    canCheckOut: boolean;
    canViewOtherDays: boolean;
  };
  reports: {
    canView: boolean;
    canExport: boolean;
  };
  users: {
    canView: boolean;
    canEdit: boolean;
    canAdd: boolean;
    canDelete: boolean;
    canInvite: boolean;
  };
  logs: {
    canView: boolean;
  };
  cleanup: {
    canView: boolean;
    canDelete: boolean;
  };
  settings: {
    canView: boolean;
    canEdit: boolean;
  };
};

// ======================================================================
// Default Permissions (คัดลอกมาจาก Task 2)
// ======================================================================

const VIEWER_DEFAULT: PagePermissions = {
  dashboard: { canView: true },
  approvals: {
    canView: true,
    canViewDetails: true,
    canApprove: false,
    canReject: false,
    canExport: false
  },
  permits: {
    canView: true,
    canViewDetails: true,
    canExport: false
  },
  dailyWork: {
    canView: false,
    canCheckIn: false,
    canCheckOut: false,
    canViewOtherDays: false
  },
  reports: {
    canView: false,
    canExport: false
  },
  users: {
    canView: false,
    canEdit: false,
    canAdd: false,
    canDelete: false,
    canInvite: false
  },
  logs: { canView: false },
  cleanup: { canView: false, canDelete: false },
  settings: { canView: false, canEdit: false }
};

const APPROVER_DEFAULT: PagePermissions = {
  ...VIEWER_DEFAULT,
  approvals: {
    canView: true,
    canViewDetails: true,
    canApprove: true,
    canReject: true,
    canExport: true
  },
  permits: {
    canView: true,
    canViewDetails: true,
    canExport: true
  },
  dailyWork: {
    canView: true,
    canCheckIn: true,
    canCheckOut: true,
    canViewOtherDays: false
  },
  reports: {
    canView: true,
    canExport: true
  }
};

const ADMIN_DEFAULT: PagePermissions = {
  ...APPROVER_DEFAULT,
  dailyWork: {
    canView: true,
    canCheckIn: true,
    canCheckOut: true,
    canViewOtherDays: true
  },
  users: {
    canView: true,
    canEdit: true,
    canAdd: true,
    canDelete: false,
    canInvite: true
  }
};

const SUPERADMIN_DEFAULT: PagePermissions = {
  dashboard: { canView: true },
  approvals: {
    canView: true,
    canViewDetails: true,
    canApprove: true,
    canReject: true,
    canExport: true
  },
  permits: {
    canView: true,
    canViewDetails: true,
    canExport: true
  },
  dailyWork: {
    canView: true,
    canCheckIn: true,
    canCheckOut: true,
    canViewOtherDays: true
  },
  reports: {
    canView: true,
    canExport: true
  },
  users: {
    canView: true,
    canEdit: true,
    canAdd: true,
    canDelete: true,
    canInvite: true
  },
  logs: { canView: true },
  cleanup: { canView: true, canDelete: true },
  settings: { canView: true, canEdit: true }
};

function getDefaultPermissions(role: string): PagePermissions {
  const normalizedRole = (role || "viewer").toLowerCase().trim();
  
  switch (normalizedRole) {
    case "viewer":
      return VIEWER_DEFAULT;
    case "approver":
      return APPROVER_DEFAULT;
    case "admin":
      return ADMIN_DEFAULT;
    case "superadmin":
    case "super_admin":
      return SUPERADMIN_DEFAULT;
    default:
      console.warn(`Unknown role: ${role}, using viewer permissions`);
      return VIEWER_DEFAULT;
  }
}

// ======================================================================
// Migration Functions
// ======================================================================

/**
 * ถามคำถามใน terminal และรอ input
 */
function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

/**
 * ฟังก์ชันหลักสำหรับ migrate
 */
async function migratePermissions(dryRun: boolean = false) {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 Permission Migration Script');
  console.log('='.repeat(70));
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes)' : '✍️  LIVE (will modify data)'}`);
  console.log('Project: work-permit-app-1e9f0');
  console.log('='.repeat(70) + '\n');
  
  try {
    // 1. Initialize Firebase Admin
    console.log('📦 Initializing Firebase Admin...');
    const serviceAccount = require('./admin-sa.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    const db = admin.firestore();
    console.log('   ✅ Firebase Admin initialized\n');
    
    // 2. ดึง Admin ทั้งหมด
    console.log('📊 Fetching all admins from Firestore...');
    const snapshot = await db.collection('admins').get();
    console.log(`   ✅ Found ${snapshot.size} admin(s)\n`);
    
    if (snapshot.empty) {
      console.log('⚠️  No admins found. Nothing to migrate.\n');
      return;
    }
    
    // 3. Confirmation (ถ้าไม่ใช่ dry run)
    if (!dryRun) {
      console.log('⚠️  WARNING: This will modify Firestore data!');
      const answer = await askQuestion('Type "yes" to continue: ');
      
      if (answer.toLowerCase() !== 'yes') {
        console.log('\n❌ Migration cancelled by user.\n');
        return;
      }
      console.log('');
    }
    
    // 4. Process แต่ละคน
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    
    console.log('🔄 Processing admins...\n');
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const email = doc.id;
      
      // ข้ามถ้ามี pagePermissions อยู่แล้ว
      if (data.pagePermissions) {
        console.log(`⏭️  [${email}] Already has pagePermissions (skipping)`);
        skipped++;
        continue;
      }
      
      // สร้าง pagePermissions ตาม role
      const role = data.role || 'viewer';
      const pagePermissions = getDefaultPermissions(role);
      
      console.log(`🔧 [${email}]`);
      console.log(`   Role: ${role}`);
      console.log(`   Permissions: ${Object.keys(pagePermissions).filter(k => 
        (pagePermissions as any)[k].canView || (pagePermissions as any)[k].canView === undefined
      ).length} pages accessible`);
      
      // Update (ถ้าไม่ใช่ dry run)
      if (!dryRun) {
        try {
          await db.collection('admins').doc(email).update({
            pagePermissions,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: 'migration-script'
          });
          console.log(`   ✅ Migrated successfully\n`);
          migrated++;
        } catch (error: any) {
          console.log(`   ❌ Error: ${error.message}\n`);
          errors++;
        }
      } else {
        console.log(`   🔍 Would migrate (dry run)\n`);
        migrated++;
      }
    }
    
    // 5. Summary
    console.log('\n' + '='.repeat(70));
    console.log('📈 Migration Summary');
    console.log('='.repeat(70));
    console.log(`✅ Migrated: ${migrated}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    if (errors > 0) {
      console.log(`❌ Errors: ${errors}`);
    }
    console.log(`📊 Total: ${snapshot.size}`);
    console.log('='.repeat(70) + '\n');
    
    if (dryRun) {
      console.log('💡 This was a dry run. Run without --dry-run to apply changes.\n');
    } else {
      console.log('✨ Migration completed!\n');
    }
    
  } catch (error: any) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ Migration failed!');
    console.error('='.repeat(70));
    console.error('Error:', error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    console.error('='.repeat(70) + '\n');
    process.exit(1);
  }
  
  process.exit(0);
}

// ======================================================================
// Main
// ======================================================================

const isDryRun = process.argv.includes('--dry-run');

migratePermissions(isDryRun);