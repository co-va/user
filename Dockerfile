FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.d/40-api-upstream.sh /docker-entrypoint.d/40-api-upstream.sh
RUN chmod +x /docker-entrypoint.d/40-api-upstream.sh

COPY index.html /usr/share/nginx/html/index.html
COPY service-worker.js /usr/share/nginx/html/service-worker.js
COPY manifest.webmanifest /usr/share/nginx/html/manifest.webmanifest
COPY app-icon.svg /usr/share/nginx/html/app-icon.svg
COPY css /usr/share/nginx/html/css
COPY core /usr/share/nginx/html/core
COPY online-booking /usr/share/nginx/html/online-booking
COPY ui /usr/share/nginx/html/ui

EXPOSE 3000
