#!/bin/sh
set -eu

CONFIG=/etc/nginx/conf.d/default.conf

if getent hosts run-book-api >/dev/null 2>&1; then
  API_UPSTREAM='http://run-book-api:3000'
else
  API_UPSTREAM='https://api.va-tools.ru'
fi

sed -i "s|__API_UPSTREAM__|${API_UPSTREAM}|g" "$CONFIG"
