# Build stage
FROM node:lts-alpine AS builder

# Set working directory
WORKDIR /app

# Add node_modules/.bin to PATH
ENV PATH="/app/node_modules/.bin:$PATH"

ARG GITHUB_TOKEN
ENV GITHUB_TOKEN=$GITHUB_TOKEN

# Install git (requis pour cloner les dépendances git)
# DL3018 ignore volontairement : Alpine ne conserve que la derniere version de
# chaque paquet dans ses depots. Epingler (curl=8.21.0-r0) casse le build des
# qu'Alpine publie un correctif : la base eclipse-temurin:21-jre-alpine est deja
# passee d'Alpine v3.23 (curl 8.20.0-r0) a v3.24 (8.21.0-r0). On veut la version
# patchee la plus recente.
# hadolint ignore=DL3018
RUN apk add --no-cache git

# Forcer Git à utiliser HTTPS au lieu de SSH pour GitHub
RUN git config --global url."https://github.com/".insteadOf git@github.com: \
    && git config --global url."https://github.com/".insteadOf ssh://git@github.com/ \
    && git config --global url."https://".insteadOf git://

# Si le dépôt design-system est privé, configurer l'authentification Git avec le token
# Cette configuration permet à npm de cloner les dépôts privés via HTTPS
RUN if [ -n "$GITHUB_TOKEN" ]; then \
        git config --global url."https://${GITHUB_TOKEN}@github.com/".insteadOf "https://github.com/"; \
    fi

COPY .npmrc .npmrc

# Copy package files
COPY package*.json ./

# Install dependencies with clean install
RUN --mount=type=cache,id=npm-cache-pme-front,target=/root/.npm \
    npm ci --prefer-offline
RUN rm .npmrc


# Copy source code
COPY . .

# Build the application
RUN npm run build

# ==========================================
# Test stage
# ==========================================
FROM builder AS tester
RUN npm run coverage

# ==========================================
# SonarQube stage
# ==========================================
FROM tester AS sonar
ARG SONAR_HOST_URL
RUN --mount=type=secret,id=SONAR_TOKEN \
    if [ -f /run/secrets/SONAR_TOKEN ]; then \
      SONAR_TOKEN="$(cat /run/secrets/SONAR_TOKEN)"; \
      export SONAR_TOKEN; \
      export SONAR_HOST_URL=${SONAR_HOST_URL}; \
      npm run sonar; \
    fi

# Production stage
FROM nginx:stable-alpine AS front
# DL3018 ignore volontairement : Alpine ne conserve que la derniere version de
# chaque paquet dans ses depots. Epingler (curl=8.21.0-r0) casse le build des
# qu'Alpine publie un correctif : la base eclipse-temurin:21-jre-alpine est deja
# passee d'Alpine v3.23 (curl 8.20.0-r0) a v3.24 (8.21.0-r0). On veut la version
# patchee la plus recente.
# hadolint ignore=DL3018
RUN apk update && apk upgrade --no-cache && apk add --no-cache curl && rm -rf /var/cache/apk/*

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from builder stage
COPY --from=builder /app/dist /app

# Create necessary directories and set permissions
RUN mkdir -p /var/cache/nginx /var/run /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/cache/nginx /var/run /var/log/nginx /app /var/run/nginx.pid && \
    chmod -R 755 /var/cache/nginx /var/run /var/log/nginx /app && \
    chmod 644 /var/run/nginx.pid

# Use nginx user instead of root
USER nginx

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
