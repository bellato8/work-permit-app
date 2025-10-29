// ======================================================================
// File: scripts/migrate-permissions.ts
// Purpose: Script สำหรับ Migrate ข้อมูล Admin เก่าให้มี pagePermissions
// Usage:
//   - Dev:  npx ts-node scripts/migrate-permissions.ts --env=dev [--dry-run]
//   - Prod: npx ts-node scripts/migrate-permissions.ts --env=prod [--dry-run]
// Created: 2025-10-14
// Updated: 2025-10-29 - เพิ่มการรองรับหลาย environments (Dev/Prod)
// ======================================================================

import * as admin from 'firebase-admin';
import * as readline from 'readline';
import * as path from 'path';
import * as fs from 'fs';

// ======================================================================
// Environment Configuration
// ⚠️ ห้าม hardcode - ต้องระบุ --env=dev หรือ --env=prod เสมอ
// ======================================================================

type Environment = 'dev' | 'prod';

interface EnvConfig {
  projectId: string;
  serviceAccountPath: string;
  displayName: string;
  color: string;
}

const ENV_CONFIGS: Record<Environment, EnvConfig> = {
  dev: {
    projectId: 'work-permit-app-dev',
    serviceAccountPath: './admin-sa-dev.json',
    displayName: '🔧 Development',
    color: '\x1b[33m' // Yellow
  },
  prod: {
    projectId: 'work-permit-app-1e9f0',
    serviceAccountPath: './admin-sa-prod.json',
    displayName: '🚀 Production',
    color: '\x1b[31m' // Red
  }
};

// ======================================================================
// Types
// ======================================================================

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
// Default Permissions
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
// Helper Functions
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
 * Parse command line arguments
 */
function parseArguments(): { env: Environment | null; dryRun: boolean } {
  const args = process.argv.slice(2);

  let env: Environment | null = null;
  let dryRun = false;

  for (const arg of args) {
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg.startsWith('--env=')) {
      const envValue = arg.split('=')[1] as Environment;
      if (envValue === 'dev' || envValue === 'prod') {
        env = envValue;
      }
    }
  }

  return { env, dryRun };
}

/**
 * แสดง usage และ exit
 */
function showUsageAndExit(): never {
  console.log('\n' + '='.repeat(70));
  console.log('❌ Error: Missing required argument --env');
  console.log('='.repeat(70));
  console.log('\nUsage:');
  console.log('  npx ts-node scripts/migrate-permissions.ts --env=<dev|prod> [--dry-run]');
  console.log('\nExamples:');
  console.log('  # Development (dry run first - recommended)');
  console.log('  npx ts-node scripts/migrate-permissions.ts --env=dev --dry-run');
  console.log('  npx ts-node scripts/migrate-permissions.ts --env=dev');
  console.log('');
  console.log('  # Production (dry run first - HIGHLY recommended)');
  console.log('  npx ts-node scripts/migrate-permissions.ts --env=prod --dry-run');
  console.log('  npx ts-node scripts/migrate-permissions.ts --env=prod');
  console.log('\nOptions:');
  console.log('  --env=dev     Use Development environment (work-permit-app-dev)');
  console.log('  --env=prod    Use Production environment (work-permit-app-1e9f0)');
  console.log('  --dry-run     Preview changes without modifying data');
  console.log('\nService Account Files Required:');
  console.log('  ./admin-sa-dev.json   - For development environment');
  console.log('  ./admin-sa-prod.json  - For production environment');
  console.log('='.repeat(70) + '\n');
  process.exit(1);
}

// ======================================================================
// Migration Function
// ======================================================================

/**
 * ฟังก์ชันหลักสำหรับ migrate
 */
async function migratePermissions(env: Environment, dryRun: boolean = false) {
  const config = ENV_CONFIGS[env];
  const resetColor = '\x1b[0m';

  console.log('\n' + '='.repeat(70));
  console.log('🚀 Permission Migration Script');
  console.log('='.repeat(70));
  console.log(`Environment: ${config.color}${config.displayName}${resetColor}`);
  console.log(`Project ID: ${config.color}${config.projectId}${resetColor}`);
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes)' : '✍️  LIVE (will modify data)'}`);
  console.log('='.repeat(70) + '\n');

  // ตรวจสอบว่า service account file มีหรือไม่
  const saPath = path.resolve(__dirname, config.serviceAccountPath);
  if (!fs.existsSync(saPath)) {
    console.error(`❌ Service account file not found: ${config.serviceAccountPath}`);
    console.error(`   Please ensure the file exists at: ${saPath}\n`);
    process.exit(1);
  }

  try {
    // 1. Initialize Firebase Admin
    console.log('📦 Initializing Firebase Admin...');
    const serviceAccount = require(saPath);

    // Double-check project ID matches
    if (serviceAccount.project_id !== config.projectId) {
      console.error(`❌ Service account project mismatch!`);
      console.error(`   Expected: ${config.projectId}`);
      console.error(`   Got: ${serviceAccount.project_id}`);
      console.error(`   Please use the correct service account file.\n`);
      process.exit(1);
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: config.projectId
    });
    const db = admin.firestore();
    console.log(`   ✅ Connected to ${config.projectId}\n`);

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
      console.log(`${config.color}⚠️  WARNING: This will modify Firestore data in ${config.displayName.toUpperCase()}!${resetColor}`);
      console.log(`   Project: ${config.projectId}`);
      const answer = await askQuestion('   Type "yes" to continue: ');

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
            updatedBy: `migration-script-${env}`
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
    console.log(`Environment: ${config.displayName}`);
    console.log(`Project: ${config.projectId}`);
    console.log(`✅ Migrated: ${migrated}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    if (errors > 0) {
      console.log(`❌ Errors: ${errors}`);
    }
    console.log(`📊 Total: ${snapshot.size}`);
    console.log('='.repeat(70) + '\n');

    if (dryRun) {
      console.log('💡 This was a dry run. Run without --dry-run to apply changes.\n');
      console.log(`   Command: npx ts-node scripts/migrate-permissions.ts --env=${env}\n`);
    } else {
      console.log('✨ Migration completed!\n');
    }

  } catch (error: any) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ Migration failed!');
    console.error('='.repeat(70));
    console.error(`Environment: ${config.displayName}`);
    console.error(`Project: ${config.projectId}`);
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

const { env, dryRun } = parseArguments();

if (!env) {
  showUsageAndExit();
}

migratePermissions(env, dryRun);
