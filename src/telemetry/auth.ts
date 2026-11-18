import { API_URL } from '../config';

export interface Sessao {
  token: string;
  jogador_id: number;
  nome_exibicao: string;
  perfil: 'jogador' | 'professor';
}

export async function login(usuario: string, senha: string): Promise<Sessao> {
  const res = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario, senha }),
  });

  if (res.status === 401 || res.status === 403) throw new Error('credenciais');
  if (!res.ok) throw new Error('servidor');
  return res.json();
}