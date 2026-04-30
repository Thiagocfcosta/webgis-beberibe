import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Busca todas as tabelas espaciais listadas no PostGIS
    const text = `
      SELECT f_table_name AS table_name, type, srid
      FROM geometry_columns
      WHERE f_table_schema = 'public'
      ORDER BY f_table_name;
    `;
    const result = await query(text);
    
    // Ler as categorias mapeadas pela CrewAI
    let metadata = {};
    try {
      const metaPath = path.join(process.cwd(), 'metadata.json');
      metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch (e) {
      console.warn('Não foi possível carregar metadata.json', e);
    }
    
    // Formatar nomes amigáveis para exibição (remover prefixos)
    const layers = result.rows.map(row => {
      let displayName = row.table_name
        .replace(/^(beberibe_|i3geomap_|zeec_)/i, '')
        .replace(/_/g, ' ');
      
      // Capitalizar primeira letra
      displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);

      const layerMeta = metadata[row.table_name] || {};

      return {
        id: row.table_name,
        name: displayName,
        type: row.type,
        category: layerMeta.category || 'Outros',
        metadata: {
          source: layerMeta.source || 'Desconhecido',
          year: layerMeta.year || 'N/A',
          scale: layerMeta.scale || 'N/A',
          description: layerMeta.description || 'Sem descrição.'
        }
      };
    });

    return NextResponse.json(layers);
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar camadas' }, { status: 500 });
  }
}
