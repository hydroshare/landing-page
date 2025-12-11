#!/bin/sh
ROOT_DIR=/srv/landing

echo "VITE_APP_BASE is '${VITE_APP_BASE}'"

# 1. Generate Caddyfile with the correct base path
sed "s|{{ .VITE_APP_BASE }}|${VITE_APP_BASE}|g" /etc/caddy/Caddyfile.template > /etc/caddy/Caddyfile

# 2. Normalize VITE_APP_BASE to remove leading and trailing slashes unless it's just "/" or "./"
# We do this beause at build time, Vite already added a leading and trailing slashes
if [ "$VITE_APP_BASE" = "/" ] || [ "$VITE_APP_BASE" = "./" ]; then
    VITE_APP_BASE="$VITE_APP_BASE"
else
    VITE_APP_BASE=$(echo "$VITE_APP_BASE" | sed 's|^/*||; s|/*$||')
fi
echo "Normalized VITE_APP_BASE is '${VITE_APP_BASE}'"

# 3. Replace placeholders in built files
echo "Replacing environment variable placeholders in built files..."
for i in $(env | grep VITE_APP_)
do
    key=$(echo $i | cut -d '=' -f 1)
    value=$(echo $i | cut -d '=' -f 2-)
    echo $key=$value
    # sed All files
    find $ROOT_DIR -type f -exec sed -i "s|${key}|${value}|g" '{}' +

    # sed JS and CSS only
    # find $ROOT_DIR -type f \( -name '*.js' -o -name '*.css' \) -exec sed -i "s|${key}|${value}|g" '{}' +
done

echo "Entrypoint completed. Starting Caddy..."
exec "$@"