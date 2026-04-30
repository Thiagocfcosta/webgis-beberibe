const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', password: '1234', database: 'beberibe', host: 'localhost', port: 5432 });

async function fixProjections() {
  console.log("Iniciando correção das projeções das tabelas...");

  const tablesToFix = [
    { name: 'beberibe', srid: 31984 },
    { name: 'beberibe_limite_municipal_2025_s2000_utm_24s', srid: 31984 },
    { name: 'curva_de_nivel_40m_srtm_ipece_utm_sirgas_2000', srid: 31984 },
    { name: 'zeec_ln_diagnostico_planicie_litoranea_1_10_000_utm24s_sirga', srid: 31984 },
    { name: 'zeec_pl_diagnostico_planicie_litoranea_1_10_000_utm24s_sirga', srid: 31984 },
    { name: 'zeec_ln_zoneamento_planicie_litoranea_1_25000_utm24s_sirgas2', srid: 31984 },
    { name: 'zeec_pl_zoneamento_planicie_litoranea_1_25000_utm24s_sirgas2', srid: 31984 },
    { name: 'zeec_pl_uso_ocupacao_planicie_litoranea_utm24s_sirgas2000', srid: 31984 },
    { name: 'rodovia_sirgas2000_23s', srid: 31983 }
  ];

  for (const t of tablesToFix) {
    try {
      console.log(`Corrigindo tabela: ${t.name} (SRID Original: ${t.srid})`);
      
      // 1. Descobrir o tipo de geometria atual
      const res = await pool.query(`SELECT type FROM geometry_columns WHERE f_table_name = $1`, [t.name]);
      if (res.rows.length === 0) {
        console.log(`Tabela ${t.name} não encontrada em geometry_columns.`);
        continue;
      }
      const geomType = res.rows[0].type; // ex: MULTIPOLYGON, MULTILINESTRING
      
      // 2. Alterar o tipo da coluna aplicando o ST_Transform com ST_Force2D
      const query = `
        ALTER TABLE ${t.name} 
        ALTER COLUMN geom TYPE geometry(${geomType}, 4326) 
        USING ST_Transform(ST_SetSRID(ST_Force2D(geom), ${t.srid}), 4326);
      `;
      await pool.query(query);
      console.log(`✅ Sucesso para ${t.name}`);
    } catch(e) {
      console.log(`❌ Erro ao corrigir ${t.name}: ${e.message}`);
    }
  }

  // Deletar a tabela vazia para não poluir o mapa
  try {
    await pool.query(`DROP TABLE IF EXISTS zeec_ln_uso_ocupacao_planicie_litoranea_utm24s_sirgas2000;`);
    console.log(`✅ Tabela vazia zeec_ln_uso_ocupacao_planicie_litoranea_utm24s_sirgas2000 deletada.`);
  } catch(e) {
    console.log(`❌ Erro ao deletar tabela vazia: ${e.message}`);
  }

  pool.end();
}

fixProjections();
