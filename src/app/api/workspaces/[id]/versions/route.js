import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:1234@localhost:5432/beberibe',
});

// Busca as versões de um mapa
export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;

    // Verificar se o mapa existe e pertence ao usuário (ou se é compartilhado)
    const checkRes = await pool.query('SELECT user_id, is_shared FROM saved_maps WHERE id = $1', [id]);
    
    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
    }

    const isOwner = checkRes.rows[0].user_id.toString() === session.user.id;
    const isAdmin = session.user.role === 'admin' || session.user.role === 'Administrador';
    const isShared = checkRes.rows[0].is_shared;

    if (!isOwner && !isAdmin && !isShared) {
      return NextResponse.json({ error: 'Não autorizado a ver o histórico deste projeto' }, { status: 403 });
    }

    const res = await pool.query(
      'SELECT id, map_id, config_json, created_at FROM map_versions WHERE map_id = $1 ORDER BY created_at DESC',
      [id]
    );

    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Erro ao buscar versões:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
