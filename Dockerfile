# # -------- BUILD STAGE --------
# FROM node:20-alpine AS builder

# WORKDIR /app

# COPY package*.json ./
# RUN npm install

# COPY . .
# RUN npx prisma generate
# RUN npm run build


# # -------- PRODUCTION STAGE --------
# FROM node:20-alpine

# WORKDIR /app

# ENV NODE_ENV=production

# COPY package*.json ./
# RUN npm install --omit=dev

# # Copy generated prisma client
# COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
# COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# # Copy compiled app
# COPY --from=builder /app/dist ./dist
# COPY --from=builder /app/prisma ./prisma

# EXPOSE 5000

# CMD ["node", "dist/main.js"]
# -------- BUILD STAGE --------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build


# -------- PRODUCTION STAGE --------
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Only install production deps
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma

EXPOSE 5000

CMD ["node", "dist/main.js"]
