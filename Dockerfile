# Stage 1: Build stage
FROM node:20-slim AS builder
WORKDIR /app

# Copy dependency manifests
COPY package.json ./
COPY prisma ./prisma/

# Install dependencies (including devDependencies for build)
RUN npm install

# Copy the rest of the application
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js application
RUN npm run build

# Remove development dependencies to keep image small
RUN npm prune --production

# Stage 2: Production runner
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy necessary production files from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# Add entrypoint script to handle startup database schema push
RUN printf '#!/bin/sh\nnpx prisma db push\nnpm run start\n' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/app/entrypoint.sh"]
