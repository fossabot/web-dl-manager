# Stage 1: Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code and Prisma schema
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build frontend and backend
RUN npm run build

# Stage 2: Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built files from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/prisma ./prisma

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL="file:./data/webdl-manager.db"

# Create data directory for SQLite
RUN mkdir -p data

# Expose the application port
EXPOSE 3000

# Start the application using Node.js directly
# We use a shell script or directly call the compiled backend entry point
CMD ["node", "dist/backend/index.js"]
