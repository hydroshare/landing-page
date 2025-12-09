FROM node:23 as build-stage
ARG VITE_APP_BASE
ARG VITE_APP_API_URL
ARG VITE_APP_NAME
ARG VITE_APP_ORIGIN
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build-prod

FROM caddy:2-alpine
COPY --from=build-stage /app/dist /usr/share/caddy
COPY Caddyfile /etc/caddy/Caddyfile