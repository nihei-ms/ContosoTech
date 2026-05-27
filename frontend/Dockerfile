# Stage 1: Build React app
FROM node:20-alpine AS build

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Serve with nginx using runtime env var for backend URL
FROM nginx:1.27-alpine

RUN apk add --no-cache bash gettext

COPY --from=build /app/dist /usr/share/nginx/html
# Use template so envsubst can inject BACKEND_URL at startup
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh && sed -i 's/\r$//' /docker-entrypoint.sh

EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
