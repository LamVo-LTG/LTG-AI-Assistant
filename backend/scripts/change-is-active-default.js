const pool = require('../src/config/database');

async function runMigration() {
  try {
    console.log('📦 Changing is_active default to false...');

    // Change the default value for is_active column
    await pool.query(`
      ALTER TABLE users
      ALTER COLUMN is_active SET DEFAULT false
    `);

    console.log('✅ Migration completed successfully!');
    console.log('   - is_active default changed from true to false');
    console.log('   - New user registrations will require admin approval');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
