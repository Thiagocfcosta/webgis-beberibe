import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request, { params }) {
  const layer = (await params).layer;
  
  // Basic sanitization to prevent SQL injection
  if (!/^[a-zA-Z0-9_]+$/.test(layer)) {
    return NextResponse.json({ error: 'Nome de camada inválido' }, { status: 400 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const clip = searchParams.get('clip') === 'true';

    // 1. Descobrir a coluna de geometria
    const geomMeta = await query(`
      SELECT f_geometry_column AS geom_col
      FROM geometry_columns
      WHERE f_table_schema = 'public' AND f_table_name = $1
    `, [layer]);

    let geomColumn = 'geom';
    if (geomMeta.rows.length > 0) {
      geomColumn = geomMeta.rows[0].geom_col;
    }
    
    let geomSelect = `ST_SimplifyPreserveTopology(${geomColumn}, 0.0001)`;
    let fromClause = `(SELECT * FROM ${layer}) inputs`;
    
    // Se o usuário pediu para recortar, intersecionamos com beberibe_limite_municipal_2025
    if (clip && layer !== 'beberibe_limite_municipal_2025') {
      geomSelect = `ST_Intersection(${geomSelect}, (SELECT ST_Union(geom) FROM beberibe_limite_municipal_2025))`;
      fromClause = `(SELECT * FROM ${layer} WHERE ST_Intersects(${geomColumn}, (SELECT ST_Union(geom) FROM beberibe_limite_municipal_2025))) inputs`;
    }

    // Construct a GeoJSON FeatureCollection directly in PostGIS
    const text = `
      SELECT jsonb_build_object(
        'type', 'FeatureCollection',
        'features', COALESCE(jsonb_agg(features.feature), '[]'::jsonb)
      ) AS geojson
      FROM (
        SELECT jsonb_build_object(
          'type', 'Feature',
          'id', row_number() OVER (),
          'geometry', ST_AsGeoJSON(${geomSelect})::jsonb,
          'properties', to_jsonb(inputs) - '${geomColumn}'
        ) AS feature
        FROM ${fromClause}
        -- Evita retornar geometrias vazias causadas por intersecções nulas
        WHERE NOT ST_IsEmpty(${geomSelect})
      ) features;
    `;
    
    const result = await query(text);
    
    if (result.rows.length === 0 || !result.rows[0].geojson) {
      return NextResponse.json({ type: 'FeatureCollection', features: [] });
    }
    
    return NextResponse.json(result.rows[0].geojson);
  } catch (error) {
    console.error("Erro ao buscar GeoJSON da camada", layer, error);
    return NextResponse.json({ error: 'Erro ao buscar dados geográficos' }, { status: 500 });
  }
}
