const pool = require('../src/config/database');

async function updateConstraint() {
  try {
    console.log('🔄 Updating constraint to allow NULL system_prompt_id for custom_prompt mode...\n');

    // Drop old constraint
    console.log('1. Dropping old constraint...');
    await pool.query(`
      ALTER TABLE conversations
      DROP CONSTRAINT IF EXISTS prompt_required
    `);
    console.log('   ✅ Old constraint dropped\n');

    // Add new constraint
    // custom_prompt mode can have NULL system_prompt_id (will use default)
    // ai_agent mode requires system_prompt_id
    // url_context mode has no requirement
    console.log('2. Adding new constraint...');
    await pool.query(`
      ALTER TABLE conversations
      ADD CONSTRAINT prompt_required CHECK (
        (mode = 'custom_prompt') OR
        (mode = 'ai_agent' AND system_prompt_id IS NOT NULL) OR
        (mode = 'url_context')
      )
    `);
    console.log('   ✅ New constraint added\n');

    console.log('✅ Constraint update complete!');
    console.log('\nNew logic:');
    console.log('  - custom_prompt mode: system_prompt_id can be NULL (uses DEFAULT_SYSTEM_PROMPT)');
    console.log('  - ai_agent mode: system_prompt_id must NOT be NULL');
    console.log('  - url_context mode: no system_prompt_id requirement');

    process.exit(0);
  } catch (error) {
    console.error('❌ Update failed:', error);
    process.exit(1);
  }
}

updateConstraint();
