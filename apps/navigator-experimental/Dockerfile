FROM nginx:stable-alpine-slim@sha256:32463212baf0e7d91aded2e9b843a4f2b9e017804b8c9d5bae7b51dcef64389c

COPY docker/40-envsubst-on-configjs.sh /docker-entrypoint.d/
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/ /usr/share/nginx/html

# make config and runtime files writable by the root group to support OpenShift
RUN chmod -R g+rwx /var/cache/nginx /var/run /var/log/nginx /etc/nginx/conf.d /usr/share/nginx
