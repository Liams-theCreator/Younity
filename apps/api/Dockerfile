FROM node:22.23.2-bookworm AS development

WORKDIR /app

RUN chown node:node /app
USER node

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

COPY --chown=node:node . .
RUN npm run prisma:generate

EXPOSE 3000

CMD ["npm", "run", "start:dev"]
