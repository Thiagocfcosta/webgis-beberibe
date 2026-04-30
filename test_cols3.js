const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://postgres:1234@localhost:5432/beberibe'
});

async function run() {
  try {
    const res = await pool.query("SELECT f_table_name FROM geometry_columns WHERE f_table_name LIKE '%rodovia%' OR f_table_name LIKE '%via%'");
    console.log("Tables:", res.rows.map(r => r.f_table_name));

    // Also check the specific columns for rodovia_sirgas2000_23s to see what values we can group by inside Beberibe
    const cteLimite = `WITH limite AS (SELECT geom FROM beberibe_limite_municipal_2025 LIMIT 1)`;
    const q = `${cteLimite} 
      SELECT r.ds_superfi, r.jurisdicao, SUM(ST_Length(ST_Intersection(r.geom, limite.geom)::geography) / 1000.0) as km
      FROM rodovia_sirgas2000_23s r, limite 
      WHERE ST_Intersects(r.geom, limite.geom)
      GROUP BY r.ds_superfi, r.jurisdicao
    `;
    const data = await pool.query(q);
    console.log("Data in Beberibe:", data.rows);

  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

run();
