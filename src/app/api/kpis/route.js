import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const kpis = {};

    // CTE base para resgatar o limite de Beberibe apenas uma vez
    const cteLimite = `WITH limite AS (SELECT geom FROM beberibe_limite_municipal_2025 LIMIT 1)`;

    // 1. Infraestrutura Viária (Soma da Extensão do trecho cruzado, convertido para KM, com agrupamento)
    // 1. Infraestrutura Viária (Soma da Extensão do trecho cruzado, convertido para KM, baseado puramente no OSM)
    try {
      const q = `${cteLimite} 
        SELECT 
          CASE 
            WHEN r.highway IN ('trunk', 'trunk_link', 'primary', 'primary_link') THEN 'Rodovias Principais'
            WHEN r.highway IN ('secondary', 'secondary_link', 'tertiary', 'tertiary_link') THEN 'Vias Arteriais/Coletoras'
            WHEN r.highway IN ('residential', 'living_street') THEN 'Vias Urbanas'
            WHEN r.highway IN ('unclassified', 'service') THEN 'Vias Locais/Rurais'
            WHEN r.highway IN ('track', 'path', 'footway', 'pedestrian', 'busway') THEN 'Caminhos e Trilhas'
            ELSE 'Outros'
          END ||
          CASE 
            WHEN r.surface IN ('paved', 'asphalt', 'concrete', 'paving_stones', 'cobblestone', 'sett') THEN ' (Pav.)'
            WHEN r.surface IN ('unpaved', 'dirt', 'earth', 'ground', 'sand', 'compacted', 'gravel') THEN ' (Terra)'
            ELSE ' (s/ info)'
          END as tipo,
          SUM(ST_Length(ST_Intersection(r.geom, limite.geom)::geography) / 1000.0) as km 
        FROM osm_roads r, limite 
        WHERE ST_Intersects(r.geom, limite.geom)
        GROUP BY 1`;
      const res = await query(q);
      
      let totalKm = 0;
      const detalhes = [];
      res.rows.forEach(r => {
        const val = Number(r.km);
        if (val > 0) {
          totalKm += val;
          detalhes.push({ tipo: r.tipo, km: val });
        }
      });
      
      kpis.rodovias_km = totalKm;
      kpis.rodovias_detalhes = detalhes.sort((a,b) => b.km - a.km);
    } catch (e) {
      console.error(e);
      kpis.rodovias_km = 0;
      kpis.rodovias_detalhes = [];
    }

    // 2. Sociocultural (Área Quilombola da intersecção, em Hectares)
    try {
      const q = `${cteLimite} 
        SELECT SUM(ST_Area(ST_Intersection(q.geom, limite.geom)::geography) / 10000.0) as total 
        FROM quilombos_sab_incra q, limite 
        WHERE ST_Intersects(q.geom, limite.geom)`;
      const res = await query(q);
      kpis.quilombos_ha = res.rows[0]?.total ? Number(res.rows[0].total) : 0;
    } catch (e) {
      kpis.quilombos_ha = 0;
    }

    // 3. Proteção Ambiental (Contagem usando ST_Intersects)
    try {
      const qEst = `${cteLimite} SELECT COUNT(*) as total FROM i3geomap_uc_estadual u, limite WHERE ST_Intersects(u.geom, limite.geom)`;
      const qFed = `${cteLimite} SELECT COUNT(*) as total FROM i3geomap_uc_federal u, limite WHERE ST_Intersects(u.geom, limite.geom)`;
      const resEst = await query(qEst);
      const resFed = await query(qFed);
      kpis.unidades_conservacao = Number(resEst.rows[0]?.total || 0) + Number(resFed.rows[0]?.total || 0);
    } catch (e) {
      kpis.unidades_conservacao = 0;
    }

    // 4. Inteligência Hídrica (Contagem de Açudes e Corpos D'Água em Beberibe)
    try {
      const qAcudes = `${cteLimite} SELECT COUNT(*) as total FROM i3geomap_acudes_monitorados a, limite WHERE ST_Intersects(a.geom, limite.geom)`;
      const qCorpos = `${cteLimite} SELECT COUNT(*) as total FROM i3geomap_corpos_d_agua c, limite WHERE ST_Intersects(c.geom, limite.geom)`;
      const resAcudes = await query(qAcudes);
      const resCorpos = await query(qCorpos);
      kpis.ativos_hidricos = Number(resAcudes.rows[0]?.total || 0) + Number(resCorpos.rows[0]?.total || 0);
    } catch (e) {
      kpis.ativos_hidricos = 0;
    }

    // 5. Demografia Base IBGE (Sempre Fixo)
    try {
      const resPop = await query('SELECT SUM(populacao_2022) as pop, SUM(domicilios_2022) as dom, SUM(area_km2) as area FROM extra_ibge_setores_beberibe');
      kpis.populacao = resPop.rows[0]?.pop ? Number(resPop.rows[0].pop) : 0;
      kpis.domicilios = resPop.rows[0]?.dom ? Number(resPop.rows[0].dom) : 0;
      kpis.area_km2 = resPop.rows[0]?.area ? Number(resPop.rows[0].area) : 0;
      kpis.densidade = kpis.area_km2 > 0 ? (kpis.populacao / kpis.area_km2) : 0;
    } catch (e) {
      kpis.populacao = 0;
      kpis.domicilios = 0;
      kpis.area_km2 = 0;
      kpis.densidade = 0;
    }

    return NextResponse.json(kpis);
  } catch (error) {
    console.error('Erro na API de KPIs Espaciais:', error);
    return NextResponse.json({ error: 'Erro ao processar KPIs espaciais' }, { status: 500 });
  }
}
