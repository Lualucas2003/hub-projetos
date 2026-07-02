# 📁 Repositorio de Projetos

Sistema web para **cadastrar, organizar e acompanhar projetos**. Tema visual em vermelho, amarelo e branco.

## Recursos
- Cadastrar, editar e excluir projetos
- Tema, programa, tags, descricao e link do repositorio
- Imagem por projeto (enviada e armazenada em base64)
- Importacao em lote via CSV (com modelo para baixar)
- Busca por nome/descricao/tema/programa/tag
- Filtros por tema e programa
- Ordenacao (recentes, antigos, nome, tema, programa, mais tags)
- Painel de estatisticas (total de projetos)
- Dados salvos em banco **PostgreSQL** (tabela `projetos`)

## Como rodar
```bash
npm install
npm start
```
Acesse: http://localhost:3000

Para desenvolvimento com auto-reload: `npm run dev`

As tabelas sao criadas automaticamente na primeira execucao.

## Banco de dados
A conexao usa a variavel de ambiente `DATABASE_URL`. Copie `.env.example` para `.env` e preencha:
```bash
cp .env.example .env
# edite o .env com a sua string de conexao
npm start
```

## Docker
Requer um arquivo `.env` com a `DATABASE_URL` (nao vai para a imagem).

Com docker compose (recomendado):
```bash
docker compose up --build
```

Ou com Docker direto:
```bash
docker build -t hub-projetos .
docker run --rm -p 3000:3000 --env-file .env hub-projetos
```
Acesse: http://localhost:3000

## Tecnologias
- Node.js + Express (backend/API REST)
- PostgreSQL (driver `pg`)
- HTML, CSS e JavaScript puro (frontend)

## API
| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/api/projetos?busca=&tema=&programa=&ordenar=` | Lista projetos |
| POST | `/api/projetos` | Cria projeto |
| POST | `/api/projetos/importar` | Importa varios projetos em lote (`{ projetos: [...] }`) |
| PUT | `/api/projetos/:id` | Atualiza projeto |
| DELETE | `/api/projetos/:id` | Exclui projeto |
| GET | `/api/opcoes` | Temas e programas cadastrados (p/ filtros) |
| GET | `/api/stats` | Estatisticas |
