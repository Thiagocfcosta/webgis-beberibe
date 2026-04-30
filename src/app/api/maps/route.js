import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:1234@localhost:5432/beberibe',
});

// Busca os mapas salvos do usuário autenticado
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const res = await pool.query(
      'SELECT id, title, description, config_json, created_at, folder_name, is_shared FROM saved_maps WHERE user_id = $1 ORDER BY created_at DESC',
      [session.user.id]
    );

    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Erro ao buscar mapas:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}

// Salva um novo mapa para o usuário autenticado
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, config_json, folder_name } = body;

    if (!title || !config_json) {
      return NextResponse.json({ error: 'Título e configurações são obrigatórios' }, { status: 400 });
    }

    const folder = folder_name && folder_name.trim() !== '' ? folder_name.trim() : 'Raiz';

    const res = await pool.query(
      'INSERT INTO saved_maps (user_id, title, description, config_json, folder_name) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [session.user.id, title, description, config_json, folder]
    );

    const mapId = res.rows[0].id;

    // Salvar a versão inicial
    await pool.query(
      'INSERT INTO map_versions (map_id, config_json) VALUES ($1, $2)',
      [mapId, config_json]
    );

    return NextResponse.json({ success: true, mapId }, { status: 201 });
  } catch (error) {
    console.error('Erro ao salvar mapa:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
