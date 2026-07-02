# 📁 Repositorio de Projetos

Sistema web para **cadastrar, organizar e acompanhar projetos**. Tema visual em vermelho, amarelo e branco.

## Recursos
- Cadastrar, editar e excluir projetos
- Tema, programa, tags, descricao e link do repositorio
- Imagem por projeto (enviada e armazenada em base64)
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
A conexao usa a variavel de ambiente `DATABASE_URL` (com um fallback embutido em `db.js`):
```bash
DATABASE_URL="postgres://usuario:senha@host:porta/banco?sslmode=disable" npm start
```

## Tecnologias
- Node.js + Express (backend/API REST)
- PostgreSQL (driver `pg`)
- HTML, CSS e JavaScript puro (frontend)

## API
| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/api/projetos?busca=&tema=&programa=&ordenar=` | Lista projetos |
| POST | `/api/projetos` | Cria projeto |
| PUT | `/api/projetos/:id` | Atualiza projeto |
| DELETE | `/api/projetos/:id` | Exclui projeto |
| GET | `/api/opcoes` | Temas e programas cadastrados (p/ filtros) |
| GET | `/api/stats` | Estatisticas |
