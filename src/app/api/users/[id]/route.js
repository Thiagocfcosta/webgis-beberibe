import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:1234@localhost:5432/beberibe',
});

const checkAdmin = async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.role !== 'admin' && session.user.role !== 'Administrador')) {
    return false;
  }
  return true;
};

// Excluir um usuário
export async function DELETE(req, { params }) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { id } = params;
    
    // Proteção para não deletar a si mesmo ou o admin principal acidentalmente
    const session = await getServerSession(authOptions);
    if (session.user.id === id) {
      return NextResponse.json({ error: 'Você não pode excluir a si mesmo.' }, { status: 400 });
    }

    // Fazemos apenas o Soft Delete (inativação)
    await pool.query('UPDATE users SET is_active = false WHERE id = $1', [id]);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar usuário:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// Atualizar cargo ou senha
export async function PUT(req, { params }) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { id } = params;
    const body = await req.json();
    
    if (body.role) {
      await pool.query('UPDATE users SET role = $1 WHERE id = $2', [body.role, id]);
    }
    
    if (body.password) {
      const hash = bcrypt.hashSync(body.password, 10);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, id]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
