FROM node:24.3.0 as node_build

# Build with the placeholder as the base
ARG VITE_APP_BASE=VITE_APP_BASE_PLACEHOLDER
ENV VITE_APP_BASE=${VITE_APP_BASE}

WORKDIR /app
COPY package.json .
COPY package-lock.json .

RUN npm install
ADD ./ ./
RUN npm run build

# Production layer
FROM caddy:2.7.6-alpine as prod

RUN apk add --no-cache bash

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Copy config
COPY Caddyfile /etc/caddy/Caddyfile

# Copy source dist
COPY --from=node_build /app/dist /srv/landing

EXPOSE 80

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]
