const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:1234@localhost:5432/beberibe'
});

async function run() {
  try {
    const res = await pool.query('SELECT * FROM users');
    console.log('Users:', res.rows);
    
    // Test updating a user
    const testUser = res.rows.find(u => u.name === 'teste');
    if (testUser) {
      console.log('Updating user', testUser.id, 'to Analista');
      const updateRes = await pool.query('UPDATE users SET role = $1 WHERE id = $2 RETURNING *', ['Analista', testUser.id]);
      console.log('Update result:', updateRes.rows);
    }
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();
