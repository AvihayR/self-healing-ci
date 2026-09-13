# Stage 1: Builder image
FROM node:24-alpine AS builder

# Workdir inside the container
WORKDIR /app

# Copy the project's depenecy file for building 
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the app
COPY . .

# Build the app
RUN npm run build



# Stage 2: Serve the app with Nginx
FROM nginx:alpine

# Copy the built application to /usr/share/nginx/html default serving route
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80 to serve the app
EXPOSE 80

# Run Nginx with the app
CMD ["nginx", "-g", "deamon off;"]