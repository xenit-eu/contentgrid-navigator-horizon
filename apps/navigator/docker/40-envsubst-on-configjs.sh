#!/bin/sh

set -e

ME=$(basename "$0")

configjs_envsubst() {
    configjs_template="${CC_CONFIGJS_TEMPLATE:-/usr/share/nginx/html/config.js.tmpl}"
    configjs_target=${CC_CONFIGJS_TARGET:-/usr/share/nginx/html/config.js}

    if [ ! -f "$configjs_template" ]; then
        echo >&2 "$ME: INFO: No template at $configjs_template, skipping (config.js served externally)"
        exit 0
    fi
    if [ -f "$configjs_target" ] && [ ! -w "$configjs_target" ]; then
        echo >&2 "$ME: ERROR: Can't write to $configjs_target"
        exit 1
    elif [ ! -w "$(dirname "$(realpath "$configjs_target")")" ]; then
        echo >&2 "$ME: ERROR: Can't write to $(dirname "$(realpath "$configjs_target")")"
        exit 1
    fi

    config_ignored=0

    if [ "$API_BASE_URL" = "" ]; then
        echo >&2 "$ME: WARN: \$API_BASE_URL is undefined"
        config_ignored=1
    fi
    if [ "$OIDC_AUTHORITY" = "" ]; then
        echo >&2 "$ME: WARN: \$OIDC_AUTHORITY is undefined"
        config_ignored=1
    fi
    if [ "$OIDC_CLIENT_ID" = "" ]; then
        echo >&2 "$ME: WARN: \$OIDC_CLIENT_ID is undefined"
        config_ignored=1
    fi

    if [ "$config_ignored" -eq 0 ]; then
        envsubst < "$configjs_template" > "$configjs_target"
    else
        echo >&2 "$ME: WARN: Missing configuration options, no configuration made"
    fi
}

configjs_envsubst

exit 0
