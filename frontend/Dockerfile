FROM oven/bun:latest

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN bun run build

# Default port for TanStack Start with vite is often 4173.
EXPOSE 4173

CMD ["bun", "run", "start"]
