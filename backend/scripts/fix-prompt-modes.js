const pool = require('../src/config/database');

async function fixPromptModes() {
  try {
    console.log('🔄 Fixing conversation modes and prompts...\n');

    // Case 1: Conversations with mode='custom_prompt' but have system_prompt_id
    // These should become mode='custom_prompt' with custom_prompt filled from system_prompts table
    console.log('1. Finding conversations with custom_prompt mode but system_prompt_id set...');
    const case1 = await pool.query(`
      SELECT c.id, c.title, c.mode, c.system_prompt_id, c.custom_prompt, sp.prompt_text
      FROM conversations c
      LEFT JOIN system_prompts sp ON c.system_prompt_id = sp.id
      WHERE c.mode = 'custom_prompt'
        AND c.system_prompt_id IS NOT NULL
    `);

    console.log(`   Found ${case1.rowCount} conversations`);

    if (case1.rowCount > 0) {
      for (const row of case1.rows) {
        console.log(`   - "${row.title}": Copying system prompt text to custom_prompt`);

        await pool.query(`
          UPDATE conversations
          SET custom_prompt = $1, system_prompt_id = NULL
          WHERE id = $2
        `, [row.prompt_text, row.id]);
      }
    }

    // Case 2: Conversations with mode='custom_prompt' but both system_prompt_id and custom_prompt
    console.log('\n2. Finding conversations with both system_prompt_id and custom_prompt...');
    const case2 = await pool.query(`
      SELECT c.id, c.title, c.mode, c.system_prompt_id, c.custom_prompt
      FROM conversations c
      WHERE c.system_prompt_id IS NOT NULL
        AND c.custom_prompt IS NOT NULL
    `);

    console.log(`   Found ${case2.rowCount} conversations`);

    if (case2.rowCount > 0) {
      for (const row of case2.rows) {
        console.log(`   - "${row.title}": Clearing custom_prompt (keeping system_prompt_id)`);

        await pool.query(`
          UPDATE conversations
          SET custom_prompt = NULL
          WHERE id = $1
        `, [row.id]);
      }
    }

    console.log('\n✅ Database cleanup complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixPromptModes();
