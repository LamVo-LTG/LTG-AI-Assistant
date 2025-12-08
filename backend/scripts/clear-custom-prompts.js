const pool = require('../src/config/database');

async function clearCustomPrompts() {
  try {
    console.log('🔄 Clearing custom_prompt values where system_prompt_id is set...');

    const result = await pool.query(`
      UPDATE conversations
      SET custom_prompt = NULL
      WHERE system_prompt_id IS NOT NULL
        AND custom_prompt IS NOT NULL
      RETURNING id, title, system_prompt_id
    `);

    console.log(`✅ Updated ${result.rowCount} conversations`);

    if (result.rowCount > 0) {
      console.log('\nUpdated conversations:');
      result.rows.forEach(row => {
        console.log(`  - ${row.title} (${row.id}) - system_prompt_id: ${row.system_prompt_id}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing custom prompts:', error);
    process.exit(1);
  }
}

clearCustomPrompts();
