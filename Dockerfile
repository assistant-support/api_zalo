# Base image
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .npmrc* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
# Cài các phụ thuộc cần thiết cho sharp trên Alpine
RUN apk add --no-cache \
    build-base \
    libvips-dev \
    && npm install --include=optional sharp
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build dự án
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app
ENV NODE_OPTIONS=--openssl-legacy-provider
ENV NODE_ENV=production
# Cấu hình biến môi trường cho Mongoose và các biến khác
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
RUN mkdir .next
RUN chown nextjs:nodejs .next

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 4003

ENV PORT=4003
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]