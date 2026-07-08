# ---------- Stage 1: Build ----------
FROM node:18-alpine AS build

WORKDIR /app

# Copy package files trước để tận dụng cache layer
COPY package.json package-lock.json ./

# Cài dependency đúng theo lock file (đảm bảo lock file đã được
# generate lại sau khi fix version Vite ở máy local)
RUN npm ci

# Copy toàn bộ source code
COPY . .

# Build Quasar SPA — quasar-cli tự lo build, không cần bước cài đặt nào thêm
RUN npx quasar build

# ---------- Stage 2: Runtime ----------
FROM nginx:1.27-alpine AS runtime

# Xóa cấu hình mặc định của nginx
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy cấu hình nginx
COPY deploy/proxy_params.conf /etc/nginx/conf.d/proxy_params.conf
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

# Copy build output từ stage build
COPY --from=build /app/dist/spa /usr/share/nginx/html

# Runtime env injection
COPY deploy/docker-entrypoint.sh /docker-entrypoint.d/40-runtime-env.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-env.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:80/healthz || exit 1