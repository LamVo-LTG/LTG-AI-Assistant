const pool = require('../src/config/database');

async function dropCustomPromptColumn() {
  try {
    console.log('🔄 Starting database migration to remove custom_prompt column...\n');

    // Step 1: Drop the old constraint that references custom_prompt
    console.log('1. Dropping old prompt_required constraint...');
    await pool.query(`
      ALTER TABLE conversations
      DROP CONSTRAINT IF EXISTS prompt_required
    `);
    console.log('   ✅ Old constraint dropped\n');

    // Step 2: Add new constraint without custom_prompt
    console.log('2. Adding new prompt_required constraint...');
    await pool.query(`
      ALTER TABLE conversations
      ADD CONSTRAINT prompt_required CHECK (
        (mode = 'custom_prompt' AND system_prompt_id IS NOT NULL) OR
        (mode = 'ai_agent' AND system_prompt_id IS NOT NULL) OR
        (mode = 'url_context')
      )
    `);
    console.log('   ✅ New constraint added\n');

    // Step 3: Drop the custom_prompt column
    console.log('3. Dropping custom_prompt column...');
    await pool.query(`
      ALTER TABLE conversations
      DROP COLUMN IF EXISTS custom_prompt
    `);
    console.log('   ✅ Column dropped\n');

    // Step 4: Verify the changes
    console.log('4. Verifying table structure...');
    const tableInfo = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'conversations'
      ORDER BY ordinal_position
    `);

    console.log('   Current columns in conversations table:');
    tableInfo.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });

    console.log('\n✅ Migration completed successfully!');
    console.log('\nNew constraint logic:');
    console.log('  - mode=\'custom_prompt\' requires system_prompt_id NOT NULL');
    console.log('  - mode=\'ai_agent\' requires system_prompt_id NOT NULL');
    console.log('  - mode=\'url_context\' has no prompt requirement');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

dropCustomPromptColumn();
