const pool = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('📦 Running Phase 3 database migration...');

    // Read the SQL file
    const sqlPath = path.join(__dirname, '../database/phase3_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute the SQL
    await pool.query(sql);

    console.log('✅ Phase 3 tables created successfully!');
    console.log('   - system_prompts');
    console.log('   - resources');
    console.log('   - conversation_resources');
    console.log('   - All indexes created');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
