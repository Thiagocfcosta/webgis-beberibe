const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:1234@localhost:5432/beberibe'
});

async function run() {
  try {
    await pool.query(`ALTER TABLE saved_maps ADD COLUMN is_shared_community BOOLEAN DEFAULT FALSE;`);
    console.log('Added is_shared_community');
  } catch(e) { console.error('Error or already exists', e.message); }

  try {
    await pool.query(`ALTER TABLE saved_maps ADD COLUMN community_status VARCHAR(20) DEFAULT 'APPROVED';`);
    console.log('Added community_status');
  } catch(e) { console.error('Error or already exists', e.message); }

  try {
    await pool.query(`ALTER TABLE saved_maps ADD COLUMN approved_by VARCHAR(255);`);
    console.log('Added approved_by');
  } catch(e) { console.error('Error or already exists', e.message); }
  
  pool.end();
}

run();
