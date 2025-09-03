# Stage 1: Base image với Node.js phiên bản Alpine cho nhẹ
FROM node:22-alpine AS base
WORKDIR /app

# Stage 2: Cài đặt tất cả dependencies (bao gồm cả devDependencies)
# Stage này sẽ được cache lại nếu package.json và package-lock.json không đổi
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Stage 3: Build ứng dụng Next.js
# Stage này chỉ chạy lại khi mã nguồn thay đổi
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 4: Tạo image production cuối cùng
# Stage này sẽ nhỏ gọn nhất có thể
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Tạo user và group riêng để chạy ứng dụng, tăng cường bảo mật
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Sao chép file package để cài đặt production dependencies
# **FIX LỖI Ở ĐÂY**: Sao chép cả package-lock.json
COPY package.json package-lock.json ./

# Cài đặt CHỈ các gói cần thiết cho production
RUN npm ci --omit=dev

# Sao chép các file cần thiết từ stage builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/server.js ./server.js

# Cấp quyền sở hữu cho user nextjs trên toàn bộ thư mục app
# Giúp ứng dụng có quyền ghi file (vd: qr.png) mà không bị lỗi permission denied
RUN chown -R nextjs:nodejs .

# Chuyển sang user không phải root
USER nextjs

EXPOSE 4003
ENV PORT=4003

# Lệnh khởi động custom server của bạn
CMD ["node", "server.js"]