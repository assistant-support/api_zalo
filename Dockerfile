# 1. Base Image
FROM node:22-alpine AS base

# 2. Dependencies Stage
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci

# 3. Builder Stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 4. Production Runner Stage (Đã chỉnh sửa)
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# Add "type": "module" to package.json
COPY package.json .

# Tạo user và group để bảo mật
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Cài đặt chỉ các dependencies cần thiết cho production
RUN npm ci --omit=dev

# Sao chép các file đã build và các file custom server
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/server.js ./server.js

# THAY ĐỔI Ở ĐÂY: Phân quyền cho toàn bộ thư mục ứng dụng
RUN chown -R nextjs:nodejs .

# Chuyển sang user nextjs
USER nextjs

EXPOSE 4002
ENV PORT=4002

# Lệnh khởi động
CMD ["node", "server.js"]