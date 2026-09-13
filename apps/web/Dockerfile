# Container deploy path. The intended AWS path ships this to CloudFront instead;
# both are supported and neither reads the other.

# Build context is the repository root, not apps/web:
#   docker build -t canary-front -f apps/web/Dockerfile .
# tsconfig.json extends ../../tsconfig.base.json, which only exists if the root
# is in the context.

# Stage 1: Builder image
FROM node:24-alpine AS builder

# Workdir inside the container
WORKDIR /repo

# The shared compiler options every app extends
COPY tsconfig.base.json ./

# Copy the project's depenecy file for building
COPY apps/web/package*.json ./apps/web/

# Install dependencies
RUN npm ci --prefix apps/web

# Copy the rest of the app
COPY apps/web ./apps/web

# Build the app
WORKDIR /repo/apps/web
RUN npm run build



# Stage 2: Serve the app with Nginx
FROM nginx:alpine

# Copy the built application to /usr/share/nginx/html default serving route
COPY --from=builder /repo/apps/web/dist /usr/share/nginx/html

# Expose port 80 to serve the app
EXPOSE 80

# Run Nginx with the app
CMD ["nginx", "-g", "daemon off;"]
