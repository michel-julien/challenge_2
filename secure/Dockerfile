FROM node:22-alpine

LABEL org.opencontainers.image.authors="major"

ENV PNPM_HOME="/pnpm"
ENV COREPACK_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"
ENV NODE_ENV="development"

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.24.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN chown -R node:node /app /pnpm

USER node

EXPOSE 5001

CMD ["pnpm", "dev"]
