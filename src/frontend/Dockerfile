FROM node:20-alpine AS build
WORKDIR /app
COPY src/frontend/package*.json ./
RUN npm ci
COPY src/frontend .
RUN npm run build
FROM nginx:alpine
COPY --from=build /app/dist/mlops-console/browser /usr/share/nginx/html
EXPOSE 80
