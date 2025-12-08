const pool = require('./src/config/database');
require('dotenv').config();

async function makeAdmin(email) {
  try {
    const result = await pool.query(
      "UPDATE users SET role = 'admin' WHERE email = $1 RETURNING id, username, email, role",
      [email]
    );

    if (result.rows.length > 0) {
      console.log('✅ User updated to admin:');
      console.log(result.rows[0]);
    } else {
      console.log('❌ User not found with email:', email);
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

// Get email from command line argument or use default
const email = process.argv[2] || 'admin@test.com';
makeAdmin(email);
