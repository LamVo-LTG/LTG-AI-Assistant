const pool = require('../src/config/database');

async function checkConstraint() {
  try {
    const result = await pool.query(`
      SELECT constraint_name, check_clause
      FROM information_schema.check_constraints
      WHERE constraint_name = 'prompt_required'
    `);

    console.log('Constraint definition:', result.rows);

    // Also check the actual table structure
    const tableInfo = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'conversations'
        AND column_name IN ('system_prompt_id', 'custom_prompt')
    `);

    console.log('\nColumn info:', tableInfo.rows);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkConstraint();
