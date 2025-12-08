const pool = require('../src/config/database');

async function migrateCustomPromptsToSystemPrompts() {
  try {
    console.log('🔄 Migrating conversations with custom_prompt to system_prompts...\n');

    // Get the user_id from one of the conversations (assuming single user for now)
    const userResult = await pool.query('SELECT DISTINCT user_id FROM conversations LIMIT 1');
    const user_id = userResult.rows[0]?.user_id;

    if (!user_id) {
      console.log('❌ No user found in conversations table');
      process.exit(1);
    }

    console.log(`📝 User ID: ${user_id}\n`);

    // Get all conversations with custom_prompt but no system_prompt_id
    const convos = await pool.query(`
      SELECT id, title, custom_prompt
      FROM conversations
      WHERE mode = 'custom_prompt'
        AND system_prompt_id IS NULL
        AND custom_prompt IS NOT NULL
    `);

    console.log(`Found ${convos.rowCount} conversations to migrate\n`);

    // Group conversations by unique custom_prompt text
    const promptGroups = {};
    convos.rows.forEach(row => {
      if (!promptGroups[row.custom_prompt]) {
        promptGroups[row.custom_prompt] = [];
      }
      promptGroups[row.custom_prompt].push(row);
    });

    console.log(`Found ${Object.keys(promptGroups).length} unique custom prompts\n`);

    // For each unique prompt, create a system_prompt and update conversations
    let migrated = 0;
    for (const [promptText, conversations] of Object.entries(promptGroups)) {
      // Create a system prompt with this text
      const promptName = `Migrated Prompt ${++migrated}`;
      console.log(`Creating system prompt: "${promptName}"`);
      console.log(`  Prompt text preview: ${promptText.substring(0, 100)}...`);
      console.log(`  Will update ${conversations.length} conversation(s)`);

      const systemPromptResult = await pool.query(`
        INSERT INTO system_prompts (user_id, name, prompt_text, description)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [
        user_id,
        promptName,
        promptText,
        `Auto-migrated from custom_prompt field`
      ]);

      const systemPromptId = systemPromptResult.rows[0].id;

      // Update all conversations using this prompt
      for (const convo of conversations) {
        await pool.query(`
          UPDATE conversations
          SET system_prompt_id = $1
          WHERE id = $2
        `, [systemPromptId, convo.id]);

        console.log(`    ✅ Updated: "${convo.title}"`);
      }

      console.log('');
    }

    console.log(`\n✅ Migration complete! Created ${migrated} system prompts and updated ${convos.rowCount} conversations`);
    console.log('\n⚠️  Next steps:');
    console.log('  1. Review the migrated system prompts');
    console.log('  2. Run drop-custom-prompt-column.js to remove the custom_prompt column');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateCustomPromptsToSystemPrompts();
