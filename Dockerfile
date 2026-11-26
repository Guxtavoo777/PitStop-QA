# ── Estágio de testes: a imagem final só é construída se a suíte passar ──
FROM node:20-alpine AS testes
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm test && touch /tmp/testes-ok

# ── Imagem final: só dependências de produção, usuário sem privilégio ──
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY . .
# amarra este estágio ao de testes (o BuildKit pularia um estágio não usado)
COPY --from=testes /tmp/testes-ok /tmp/testes-ok
RUN rm -rf tests landing3d coverage && mkdir -p public/uploads && chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:${PORT:-3000}/health || exit 1
CMD ["node", "server.js"]
