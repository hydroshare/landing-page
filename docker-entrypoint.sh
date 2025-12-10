#!/bin/sh
ROOT_DIR=/srv/landing

echo "VITE_APP_BASE is '${VITE_APP_BASE}'"

# Normalize: remove leading slash, ensure trailing slash
BASE_PATH=$(echo "${VITE_APP_BASE}" | sed 's|^/||')
# Ensure it ends with slash for consistency
if [[ "${BASE_PATH}" != */ ]]; then
    BASE_PATH="${BASE_PATH}/"
fi

echo "Normalized BASE_PATH is '/${BASE_PATH}'"

# 1. Generate Caddyfile with the correct base path
echo "Generating Caddyfile with base path: /${BASE_PATH}"
sed "s|{{ .BASE_PATH }}|/${BASE_PATH}|g" /etc/caddy/Caddyfile.template > /etc/caddy/Caddyfile

# 2. Replace placeholders in built files
echo "Replacing placeholders in built files..."
for file in $ROOT_DIR/assets/*.js $ROOT_DIR/index.html $ROOT_DIR/*.css;
do
    if [ -f "$file" ]; then
        echo "Processing $file ...";
        # Replace /VITE_APP_BASE_PLACEHOLDER/ with /${BASE_PATH}
        sed -i "s|/VITE_APP_BASE_PLACEHOLDER/|/${BASE_PATH}|g" "$file"
        # Also replace any other occurrences
        sed -i "s|VITE_APP_BASE_PLACEHOLDER|${BASE_PATH}|g" "$file"
    fi
done

echo "Entrypoint completed. Starting Caddy..."
exec "$@"