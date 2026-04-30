import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:1234@localhost:5432/beberibe',
});

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const { is_favorite } = await req.json();

    const checkRes = await pool.query('SELECT user_id, is_shared, is_shared_community, community_status FROM saved_maps WHERE id = $1', [id]);
    
    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
    }

    const map = checkRes.rows[0];
    
    const isSharedCommunity = map.is_shared_community && map.community_status === 'APPROVED';

    // Só pode favoritar se for o dono ou se o projeto for compartilhado
    if (map.user_id.toString() !== session.user.id && !map.is_shared && !isSharedCommunity) {
      return NextResponse.json({ error: 'Você não tem permissão para favoritar este projeto privado' }, { status: 403 });
    }

    if (is_favorite) {
      await pool.query('INSERT INTO map_favorites (map_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, session.user.id]);
    } else {
      await pool.query('DELETE FROM map_favorites WHERE map_id = $1 AND user_id = $2', [id, session.user.id]);
    }

    return NextResponse.json({ success: true, is_favorite }, { status: 200 });
  } catch (error) {
    console.error('Erro ao alternar favorito:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
