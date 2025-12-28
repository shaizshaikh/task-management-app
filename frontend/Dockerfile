# ---- Stage 1: Build React app ----
FROM node:16-alpine AS build
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the React app for production
RUN npm run build

# ---- Stage 2: Serve with nginx ----
FROM nginx:alpine

# Copy React build from previous stage into nginx html folder
COPY --from=build /app/build /usr/share/nginx/html

# Remove default nginx config and create a simple one
RUN rm /etc/nginx/conf.d/default.conf

# Create a simple nginx config that works
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Expose port 80 (nginx default)
EXPOSE 80

# Run nginx
CMD ["nginx", "-g", "daemon off;"]
