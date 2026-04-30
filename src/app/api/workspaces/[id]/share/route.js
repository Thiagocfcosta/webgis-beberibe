import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:1234@localhost:5432/beberibe',
});

// Altera o status de compartilhamento de um projeto
export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { is_shared, is_shared_community } = body;

    // Verificar se o mapa existe e pertence ao usuário (ou se é admin)
    const checkRes = await pool.query('SELECT user_id FROM saved_maps WHERE id = $1', [id]);
    
    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
    }

    if (checkRes.rows[0].user_id.toString() !== session.user.id && session.user.role !== 'admin' && session.user.role !== 'Administrador') {
      return NextResponse.json({ error: 'Não autorizado a alterar este projeto' }, { status: 403 });
    }

    let updateFields = [];
    let queryParams = [];
    let idx = 1;

    if (is_shared !== undefined) {
      updateFields.push(`is_shared = $${idx++}`);
      queryParams.push(is_shared);
    }

    if (is_shared_community !== undefined) {
      updateFields.push(`is_shared_community = $${idx++}`);
      queryParams.push(is_shared_community);
      
      if (is_shared_community === true) {
        if (session.user.role === 'Visualizador') {
          updateFields.push(`community_status = 'APPROVED'`);
        } else {
          updateFields.push(`community_status = 'PENDING'`);
        }
      }
    }

    if (updateFields.length > 0) {
      queryParams.push(id);
      await pool.query(`UPDATE saved_maps SET ${updateFields.join(', ')} WHERE id = $${idx}`, queryParams);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Erro ao alterar compartilhamento:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
