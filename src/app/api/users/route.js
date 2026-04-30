import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:1234@localhost:5432/beberibe',
});

// Helper para verificar se é admin
const checkAdmin = async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.role !== 'admin' && session.user.role !== 'Administrador')) {
    return false;
  }
  return true;
};

// Listar todos os usuários
export async function GET(req) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const res = await pool.query('SELECT id, name, email, role, created_at FROM users WHERE is_active = true ORDER BY created_at DESC');
    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// Criar um novo usuário
export async function POST(req) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { name, email, password, role } = await req.json();

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 });
    }

    // Verificar se email já existe
    const existCheck = await pool.query('SELECT id, is_active FROM users WHERE email = $1', [email]);
    const hash = bcrypt.hashSync(password, 10);

    if (existCheck.rows.length > 0) {
      const user = existCheck.rows[0];
      if (user.is_active) {
        return NextResponse.json({ error: 'E-mail já está em uso.' }, { status: 409 });
      } else {
        // Usuário inativo: ressuscitamos a conta
        const res = await pool.query(
          'UPDATE users SET name = $1, password_hash = $2, role = $3, is_active = true WHERE id = $4 RETURNING id, name, email, role',
          [name, hash, role, user.id]
        );
        return NextResponse.json(res.rows[0], { status: 200 });
      }
    }

    // Cria novo usuário se não existia
    const res = await pool.query(
      'INSERT INTO users (name, email, password_hash, role, is_active) VALUES ($1, $2, $3, $4, true) RETURNING id, name, email, role',
      [name, email, hash, role]
    );

    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
