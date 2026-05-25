FROM oven/bun:1.3-alpine AS build
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1.3-alpine
RUN apk add --no-cache tshark
WORKDIR /app
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
ENV NODE_ENV=production
ENV PCAP_DB=/app/data/pcap-parser.db
ENV PCAP_CAPTURES_DIR=/app/captures
EXPOSE 3000
VOLUME ["/app/data", "/app/captures"]
CMD ["bun", "build/index.js"]
