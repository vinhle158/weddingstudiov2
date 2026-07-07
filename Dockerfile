# Stage 1: Build the application
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 2: Production image
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
# Copy built files, prisma, and config folder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/config ./config
# Generate prisma client for production environment
RUN npx prisma generate

ENV NODE_ENV=production
ENV PORT=3005
EXPOSE 3005

# Run migration (db push) at container startup, then start server
CMD ["sh", "-c", "npx prisma db push && node dist/server.cjs"]
