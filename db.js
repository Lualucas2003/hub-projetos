import pg from "pg";

const CONNECTION_STRING = process.env.DATABASE_URL;

if (!CONNECTION_STRING) {
  throw new Error(
    "DATABASE_URL nao definida. Copie .env.example para .env e preencha a string de conexao (ou exporte a variavel de ambiente)."
  );
}

export const pool = new pg.Pool({
  connectionString: CONNECTION_STRING,
  // sslmode=disable na string ja desativa TLS; mantido explicito por seguranca
  ssl: false,
});

// Cria as tabelas caso ainda nao existam
export async function inicializarBanco() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projetos (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nome        TEXT NOT NULL,
      descricao   TEXT NOT NULL DEFAULT '',
      status      TEXT NOT NULL DEFAULT 'ativo',
      tema        TEXT NOT NULL DEFAULT '',
      programa    TEXT NOT NULL DEFAULT '',
      tags        TEXT[] NOT NULL DEFAULT '{}',
      url         TEXT NOT NULL DEFAULT '',
      imagem      TEXT NOT NULL DEFAULT '',
      criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Para bancos criados antes da coluna de imagem existir
  await pool.query(`ALTER TABLE projetos ADD COLUMN IF NOT EXISTS imagem TEXT NOT NULL DEFAULT '';`);

  // Indices para acelerar filtros e ordenacao
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_projetos_status ON projetos (status);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_projetos_tema ON projetos (tema);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_projetos_programa ON projetos (programa);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_projetos_criado_em ON projetos (criado_em DESC);`);
}

// Converte uma linha do banco (snake_case) para o formato usado pela API/front (camelCase)
export function mapearProjeto(row) {
  return {
    id: row.id,
    nome: row.nome,
    descricao: row.descricao,
    status: row.status,
    tema: row.tema,
    programa: row.programa,
    tags: row.tags || [],
    url: row.url,
    imagem: row.imagem || "",
    criadoEm: row.criado_em instanceof Date ? row.criado_em.toISOString() : row.criado_em,
    atualizadoEm:
      row.atualizado_em instanceof Date ? row.atualizado_em.toISOString() : row.atualizado_em,
  };
}
