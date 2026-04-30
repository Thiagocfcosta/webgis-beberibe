const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://postgres:1234@localhost:5432/beberibe'
});

async function run() {
  try {
    const cteLimite = `WITH limite AS (SELECT geom FROM beberibe_limite_municipal_2025 LIMIT 1)`;
    
    const rRodovia = await pool.query(`${cteLimite} SELECT SUM(ST_Length(ST_Intersection(r.geom, limite.geom)::geography) / 1000.0) as total FROM rodovia_sirgas2000_23s r, limite WHERE ST_Intersects(r.geom, limite.geom)`);
    console.log('Rodovias KM:', rRodovia.rows[0].total);

    const rQuilombo = await pool.query(`${cteLimite} SELECT SUM(ST_Area(ST_Intersection(q.geom, limite.geom)::geography) / 10000.0) as total FROM quilombos_sab_incra q, limite WHERE ST_Intersects(q.geom, limite.geom)`);
    console.log('Quilombos HA:', rQuilombo.rows[0].total);

    const rUce = await pool.query(`${cteLimite} SELECT COUNT(*) as total FROM i3geomap_uc_estadual u, limite WHERE ST_Intersects(u.geom, limite.geom)`);
    const rUcf = await pool.query(`${cteLimite} SELECT COUNT(*) as total FROM i3geomap_uc_federal u, limite WHERE ST_Intersects(u.geom, limite.geom)`);
    console.log('UCs:', Number(rUce.rows[0].total) + Number(rUcf.rows[0].total));

    const rAcu = await pool.query(`${cteLimite} SELECT COUNT(*) as total FROM i3geomap_acudes_monitorados a, limite WHERE ST_Intersects(a.geom, limite.geom)`);
    const rCor = await pool.query(`${cteLimite} SELECT COUNT(*) as total FROM i3geomap_corpos_d_agua c, limite WHERE ST_Intersects(c.geom, limite.geom)`);
    console.log('Ativos Hidricos:', Number(rAcu.rows[0].total) + Number(rCor.rows[0].total));

  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

run();
