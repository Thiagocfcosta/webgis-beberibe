const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://postgres:1234@localhost:5432/beberibe'
});

async function run() {
  try {
    const q = `
      WITH limite AS (SELECT geom FROM beberibe_limite_municipal_2025 LIMIT 1)
      SELECT 
        highway as tipo, 
        surface,
        SUM(ST_Length(ST_Intersection(r.geom, limite.geom)::geography) / 1000.0) as km 
      FROM osm_roads r, limite 
      WHERE ST_Intersects(r.geom, limite.geom)
      GROUP BY highway, surface
      ORDER BY km DESC;
    `;
    const res = await pool.query(q);
    console.log(res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

run();
