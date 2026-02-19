FROM oven/bun:latest

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install

COPY . .

RUN bun run build

EXPOSE 3000

# TanStack Start with Bun usually runs the build output.
# Default port for TanStack Start is often 3000, 
# but let's assume it defaults to what's defined in the environment.
CMD ["bun", "run", "start"]
