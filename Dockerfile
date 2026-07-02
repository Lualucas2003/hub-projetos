# Imagem base enxuta com Node.js
FROM node:22-alpine

# Diretorio de trabalho dentro do container
WORKDIR /app

# Instala apenas as dependencias de producao (usa o cache de camadas)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copia o restante do codigo (respeitando o .dockerignore)
COPY . .

# Ambiente e porta
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# A aplicacao precisa da variavel DATABASE_URL em tempo de execucao
# (passe com --env-file .env ou -e DATABASE_URL=...)
CMD ["node", "server.js"]
