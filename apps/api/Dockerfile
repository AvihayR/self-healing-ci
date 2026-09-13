# Build context is the repository root, not apps/api:
#   docker build -t canary-back -f apps/api/Dockerfile .

# Stage 1: Builder image
FROM node:22-alpine AS builder

# Set workdir inside the container
WORKDIR /repo

# Copy shared tsconfig
COPY tsconfig.base.json ./

# Copy backend's app dependency file for building.
# The trailing slash matters: the glob matches two files, and a multi-file COPY
# needs a directory as its destination or both collapse into one file.
COPY apps/api/package*.json ./apps/api/

# Install deps — all of them. tsc lives in devDependencies, so the build cannot
# run without them; they are pruned after the build instead.
RUN npm ci --prefix apps/api

# Copy rest of the app
COPY apps/api ./apps/api

# Build
WORKDIR /repo/apps/api
RUN npm run build

# Drop devDependencies now that dist/ exists, so only runtime deps are copied
# into the serving image.
RUN npm prune --omit=dev


# Stage 2: Serve backend
FROM gcr.io/distroless/nodejs22-debian12

# Set workdir inside the container
WORKDIR /app

# Copy compiled app
COPY --from=builder /repo/apps/api/dist ./dist
COPY --from=builder /repo/apps/api/node_modules ./node_modules

# server.ts defaults HOST to 127.0.0.1, which inside a container binds loopback
# only — the port publish then refuses connections. Both are overridable at run
# time with -e.
ENV HOST=0.0.0.0
ENV PORT=3000

# Documentation only; publish the port with `docker run -p 8080:3000`.
EXPOSE 3000

# Run node to serve the compiled backend.
# No `node` in the command: the distroless image's entrypoint is already node.
CMD ["dist/server.js"]
