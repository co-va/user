FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY index.html /usr/share/nginx/html/index.html
COPY service-worker.js /usr/share/nginx/html/service-worker.js
COPY manifest.webmanifest /usr/share/nginx/html/manifest.webmanifest
COPY user-icon.svg /usr/share/nginx/html/user-icon.svg
COPY css /usr/share/nginx/html/css
COPY core /usr/share/nginx/html/core
COPY user /usr/share/nginx/html/user
COPY ui /usr/share/nginx/html/ui

EXPOSE 3000
