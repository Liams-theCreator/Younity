FROM node:22.23.2-bookworm-slim AS development

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN chown node:node /app
USER node

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --no-audit --no-fund && npm cache clean --force

COPY --chown=node:node . .
RUN npm run prisma:generate

EXPOSE 3000

CMD ["npm", "run", "start:dev"]
