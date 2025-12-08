const pool = require('../src/config/database');

async function checkInvalidConversations() {
  try {
    console.log('🔍 Checking for conversations that violate the new constraint...\n');

    // Find conversations with mode='custom_prompt' but no system_prompt_id
    const result1 = await pool.query(`
      SELECT id, title, mode, system_prompt_id, custom_prompt
      FROM conversations
      WHERE mode = 'custom_prompt' AND system_prompt_id IS NULL
    `);

    console.log(`Found ${result1.rowCount} conversations with mode='custom_prompt' but no system_prompt_id:`);
    result1.rows.forEach(row => {
      console.log(`  - ID: ${row.id}, Title: "${row.title}", custom_prompt: ${row.custom_prompt ? 'YES' : 'NO'}`);
    });

    // Find conversations with mode='ai_agent' but no system_prompt_id
    const result2 = await pool.query(`
      SELECT id, title, mode, system_prompt_id, custom_prompt
      FROM conversations
      WHERE mode = 'ai_agent' AND system_prompt_id IS NULL
    `);

    console.log(`\nFound ${result2.rowCount} conversations with mode='ai_agent' but no system_prompt_id:`);
    result2.rows.forEach(row => {
      console.log(`  - ID: ${row.id}, Title: "${row.title}", custom_prompt: ${row.custom_prompt ? 'YES' : 'NO'}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkInvalidConversations();
