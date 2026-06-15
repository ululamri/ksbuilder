FROM node:24-alpine AS dependencies
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY . .
RUN pnpm check && pnpm build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 SPARK_BUILDER_DATA_DIR=/data
WORKDIR /app
RUN addgroup -S spark && adduser -S spark -G spark && mkdir -p /data && chown spark:spark /data
COPY --from=build --chown=spark:spark /app/build ./build
COPY --from=build --chown=spark:spark /app/package.json ./package.json
USER spark
EXPOSE 3000
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -qO- http://127.0.0.1:3000/health/ready || exit 1
CMD ["node", "build"]
