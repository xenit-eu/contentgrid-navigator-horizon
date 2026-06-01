FROM nginx:stable-alpine-slim

COPY docker/40-envsubst-on-configjs.sh /docker-entrypoint.d/
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/ /usr/share/nginx/html

# make config and runtime files writable by the root group to support OpenShift
RUN chmod -R g+rwx /var/cache/nginx /var/run /var/log/nginx /etc/nginx/conf.d /usr/share/nginx
