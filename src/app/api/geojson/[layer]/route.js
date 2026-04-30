import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request, { params }) {
  const layer = (await params).layer;
  
  // Basic sanitization to prevent SQL injection
  if (!/^[a-zA-Z0-9_]+$/.test(layer)) {
    return NextResponse.json({ error: 'Nome de camada inválido' }, { status: 400 });
  }

  try {
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

    // Construct a GeoJSON FeatureCollection directly in PostGIS
    // We use ST_SimplifyPreserveTopology to reduce the payload size
    // and speed up the rendering on the frontend.
    const text = `
      SELECT jsonb_build_object(
        'type', 'FeatureCollection',
        'features', jsonb_agg(features.feature)
      ) AS geojson
      FROM (
        SELECT jsonb_build_object(
          'type', 'Feature',
          'id', row_number() OVER (),
          'geometry', ST_AsGeoJSON(ST_SimplifyPreserveTopology(${geomColumn}, 0.0001))::jsonb,
          'properties', to_jsonb(inputs) - '${geomColumn}'
        ) AS feature
        FROM (SELECT * FROM ${layer}) inputs
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
