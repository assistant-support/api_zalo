# =========================
# Stage 1: Ảnh base (Node Alpine)
# =========================
FROM node:22-alpine AS base
WORKDIR /app
# Thư viện hay dùng với Next/Sharp trên Alpine
RUN apk add --no-cache libc6-compat

# =========================
# Stage 2: Cài deps (bao gồm devDeps) để build
# =========================
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# =========================
# Stage 3: Build Next.js
# =========================
FROM base AS builder
# Dùng node_modules từ stage deps
COPY --from=deps /app/node_modules ./node_modules
# Copy toàn bộ mã nguồn để build
COPY . .
# Build production
RUN npm run build

# =========================
# Stage 4: Image chạy production
# =========================
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat

ENV NODE_ENV=production
ENV PORT=4003
# (tuỳ bạn) tắt telemetry của Next
ENV NEXT_TELEMETRY_DISABLED=1

# Tạo user không phải root
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Cài production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy artefact build + code cần cho server runtime
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/server.js ./server.js

# 💡 FIX CHÍNH: copy thêm models để server.js import được
COPY --from=builder /app/models ./models

# Nếu server.js còn import các thư mục backend khác, bạn có thể mở thêm:
# COPY --from=builder /app/routes ./routes
# COPY --from=builder /app/controllers ./controllers
# COPY --from=builder /app/services ./services
# COPY --from=builder /app/utils ./utils
# COPY --from=builder /app/middleware ./middleware
# COPY --from=builder /app/sockets ./sockets
# COPY --from=builder /app/config ./config

# Phân quyền cho user non-root
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 4003
CMD ["node", "server.js"]
