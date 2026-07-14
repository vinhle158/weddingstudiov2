# Giai đoạn 1: Biên dịch ứng dụng.
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

# Giai đoạn 2: Tạo image production tối giản.
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache curl
COPY package*.json ./
RUN npm install --omit=dev
# Chỉ sao chép bản build, Prisma schema và cấu hình cần thiết khi chạy.
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/config ./config
# Sinh Prisma Client phù hợp với môi trường production.
RUN npx prisma generate

ENV NODE_ENV=production
ENV PORT=3005
EXPOSE 3005

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3005/healthz || exit 1

# Thay đổi schema phải được chạy riêng bằng `prisma migrate deploy` trước khi khởi động app.
CMD ["node", "dist/server.cjs"]
