import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { pool, inicializarBanco, mapearProjeto } from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
// Limite ampliado para acomodar imagens em base64
app.use(express.json({ limit: "12mb" }));
app.use(express.static(join(__dirname, "public")));

// Valida/normaliza a imagem recebida: aceita apenas data URL de imagem (base64)
function normalizarImagem(imagem) {
  const v = String(imagem || "").trim();
  if (!v) return "";
  if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(v)) return "";
  return v;
}

// Normaliza tags recebidas (array ou string separada por virgula) -> array
function normalizarTags(tags) {
  if (Array.isArray(tags)) return tags.map((t) => String(t).trim()).filter(Boolean);
  return String(tags || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

// Mapeia a opcao de ordenacao para uma clausula ORDER BY segura (whitelist)
const ORDENACOES = {
  recentes: "criado_em DESC",
  antigos: "criado_em ASC",
  nome: "nome ASC",
  "nome-desc": "nome DESC",
  tema: "tema ASC, nome ASC",
  programa: "programa ASC, nome ASC",
  tags: "cardinality(tags) DESC, nome ASC",
};

// ---- API ----

// Listar (com busca, filtros e ordenacao opcionais)
app.get("/api/projetos", async (req, res) => {
  try {
    const { busca = "", status = "", tema = "", programa = "", ordenar = "recentes" } = req.query;
    const condicoes = [];
    const valores = [];

    const termo = String(busca).trim();
    if (termo) {
      valores.push(`%${termo}%`);
      const i = valores.length;
      condicoes.push(
        `(nome ILIKE $${i} OR descricao ILIKE $${i} OR tema ILIKE $${i} OR programa ILIKE $${i} OR array_to_string(tags, ',') ILIKE $${i})`
      );
    }
    if (status) {
      valores.push(status);
      condicoes.push(`status = $${valores.length}`);
    }
    if (tema) {
      valores.push(tema);
      condicoes.push(`tema = $${valores.length}`);
    }
    if (programa) {
      valores.push(programa);
      condicoes.push(`programa = $${valores.length}`);
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
    const orderBy = ORDENACOES[String(ordenar)] || ORDENACOES.recentes;

    const { rows } = await pool.query(
      `SELECT * FROM projetos ${where} ORDER BY ${orderBy}`,
      valores
    );
    res.json(rows.map(mapearProjeto));
  } catch (e) {
    console.error("Erro ao listar projetos:", e.message);
    res.status(500).json({ erro: "Erro ao listar projetos." });
  }
});

// Opcoes distintas para os filtros (temas e programas cadastrados)
app.get("/api/opcoes", async (_req, res) => {
  try {
    const temas = await pool.query(
      `SELECT DISTINCT tema FROM projetos WHERE tema <> '' ORDER BY tema`
    );
    const programas = await pool.query(
      `SELECT DISTINCT programa FROM projetos WHERE programa <> '' ORDER BY programa`
    );
    res.json({
      temas: temas.rows.map((r) => r.tema),
      programas: programas.rows.map((r) => r.programa),
    });
  } catch (e) {
    console.error("Erro ao buscar opcoes:", e.message);
    res.status(500).json({ erro: "Erro ao buscar opcoes." });
  }
});

// Criar
app.post("/api/projetos", async (req, res) => {
  try {
    const {
      nome,
      descricao = "",
      status = "ativo",
      tags = [],
      url = "",
      tema = "",
      programa = "",
      imagem = "",
    } = req.body || {};
    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ erro: "O nome do projeto e obrigatorio." });
    }
    const { rows } = await pool.query(
      `INSERT INTO projetos (nome, descricao, status, tema, programa, tags, url, imagem)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        String(nome).trim(),
        String(descricao).trim(),
        status,
        String(tema).trim(),
        String(programa).trim(),
        normalizarTags(tags),
        String(url).trim(),
        normalizarImagem(imagem),
      ]
    );
    res.status(201).json(mapearProjeto(rows[0]));
  } catch (e) {
    console.error("Erro ao criar projeto:", e.message);
    res.status(500).json({ erro: "Erro ao criar projeto." });
  }
});

// Importar em lote (varios projetos de uma vez, ex.: vindos de CSV)
app.post("/api/projetos/importar", async (req, res) => {
  const lista = Array.isArray(req.body?.projetos) ? req.body.projetos : [];
  if (!lista.length) {
    return res.status(400).json({ erro: "Nenhum projeto para importar." });
  }

  const cliente = await pool.connect();
  let inseridos = 0;
  const erros = [];
  try {
    await cliente.query("BEGIN");
    for (let i = 0; i < lista.length; i++) {
      const p = lista[i] || {};
      const nome = String(p.nome || "").trim();
      if (!nome) {
        erros.push({ linha: i + 1, erro: "nome vazio" });
        continue;
      }
      await cliente.query(
        `INSERT INTO projetos (nome, descricao, tema, programa, tags, url)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          nome,
          String(p.descricao || "").trim(),
          String(p.tema || "").trim(),
          String(p.programa || "").trim(),
          normalizarTags(p.tags),
          String(p.url || "").trim(),
        ]
      );
      inseridos++;
    }
    await cliente.query("COMMIT");
    res.status(201).json({ inseridos, ignorados: erros.length, erros });
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    console.error("Erro ao importar projetos:", e.message);
    res.status(500).json({ erro: "Erro ao importar projetos." });
  } finally {
    cliente.release();
  }
});

// Atualizar
app.put("/api/projetos/:id", async (req, res) => {
  try {
    const { nome, descricao, status, tags, url, tema, programa, imagem } = req.body || {};

    // Monta atualizacao dinamica apenas com os campos enviados
    const campos = [];
    const valores = [];
    const set = (coluna, valor) => {
      valores.push(valor);
      campos.push(`${coluna} = $${valores.length}`);
    };

    if (nome !== undefined && String(nome).trim()) set("nome", String(nome).trim());
    if (descricao !== undefined) set("descricao", String(descricao).trim());
    if (status !== undefined) set("status", status);
    if (tema !== undefined) set("tema", String(tema).trim());
    if (programa !== undefined) set("programa", String(programa).trim());
    if (url !== undefined) set("url", String(url).trim());
    if (tags !== undefined) set("tags", normalizarTags(tags));
    if (imagem !== undefined) set("imagem", normalizarImagem(imagem));

    if (!campos.length) {
      return res.status(400).json({ erro: "Nenhum campo para atualizar." });
    }
    campos.push(`atualizado_em = now()`);

    valores.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE projetos SET ${campos.join(", ")} WHERE id = $${valores.length} RETURNING *`,
      valores
    );
    if (!rows.length) return res.status(404).json({ erro: "Projeto nao encontrado." });
    res.json(mapearProjeto(rows[0]));
  } catch (e) {
    console.error("Erro ao atualizar projeto:", e.message);
    res.status(500).json({ erro: "Erro ao atualizar projeto." });
  }
});

// Excluir
app.delete("/api/projetos/:id", async (req, res) => {
  try {
    const { rowCount } = await pool.query(`DELETE FROM projetos WHERE id = $1`, [req.params.id]);
    if (!rowCount) return res.status(404).json({ erro: "Projeto nao encontrado." });
    res.status(204).end();
  } catch (e) {
    console.error("Erro ao excluir projeto:", e.message);
    res.status(500).json({ erro: "Erro ao excluir projeto." });
  }
});

// Estatisticas
app.get("/api/stats", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'ativo')::int AS ativos,
        COUNT(*) FILTER (WHERE status = 'concluido')::int AS concluidos,
        COUNT(*) FILTER (WHERE status = 'pausado')::int AS pausados
      FROM projetos
    `);
    res.json(rows[0]);
  } catch (e) {
    console.error("Erro ao buscar estatisticas:", e.message);
    res.status(500).json({ erro: "Erro ao buscar estatisticas." });
  }
});

const PORT = process.env.PORT || 3000;

// Garante o schema antes de aceitar requisicoes
inicializarBanco()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n  Repositorio de Projetos rodando em: http://localhost:${PORT}\n`);
    });
  })
  .catch((e) => {
    console.error("Falha ao inicializar o banco de dados:", e.message);
    process.exit(1);
  });
