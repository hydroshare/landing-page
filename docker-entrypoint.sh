#!/bin/sh
ROOT_DIR=/srv/landing

echo "Starting entrypoint script..."
echo "VITE_APP_BASE environment variable is: '${VITE_APP_BASE:-/landing/}'"

# Set default value if not provided
VITE_APP_BASE="${VITE_APP_BASE:-/landing/}"

# Ensure the base path ends with a slash (for consistency)
if [[ "${VITE_APP_BASE}" != */ ]]; then
    VITE_APP_BASE="${VITE_APP_BASE}/"
fi

# Escape special characters for sed
escape_sed() {
    echo "$1" | sed -e 's/[\/&]/\\&/g'
}

ESCAPED_BASE=$(escape_sed "$VITE_APP_BASE")
ESCAPED_PLACEHOLDER=$(escape_sed "VITE_APP_BASE_PLACEHOLDER")

echo "Replacing VITE_APP_BASE_PLACEHOLDER with: '$VITE_APP_BASE'"
echo "Escaped base: '$ESCAPED_BASE'"

# Process ALL files that might contain the placeholder
find "$ROOT_DIR" -type f \( -name "*.js" -o -name "*.css" -o -name "*.html" -o -name "*.json" \) | while read -r file; do
    if grep -q "VITE_APP_BASE_PLACEHOLDER" "$file" 2>/dev/null; then
        echo "Processing $file ..."
        # Use a temporary file to avoid issues with sed on busybox
        sed "s|${ESCAPED_PLACEHOLDER}|${ESCAPED_BASE}|g" "$file" > "${file}.tmp"
        mv "${file}.tmp" "$file"
    fi
    
    # Also check for the escaped version that might appear in JavaScript strings
    # Vite might encode the slash as \/
    ESCAPED_PLACEHOLDER_SLASH=$(escape_sed "VITE_APP_BASE_PLACEHOLDER/")
    if grep -q "${ESCAPED_PLACEHOLDER_SLASH}" "$file" 2>/dev/null; then
        echo "Processing escaped placeholder in $file ..."
        sed "s|${ESCAPED_PLACEHOLDER_SLASH}|${ESCAPED_BASE}|g" "$file" > "${file}.tmp"
        mv "${file}.tmp" "$file"
    fi
done

# Also replace in index.html specifically (just in case)
if [ -f "$ROOT_DIR/index.html" ]; then
    echo "Processing index.html specifically..."
    sed "s|${ESCAPED_PLACEHOLDER}|${ESCAPED_BASE}|g" "$ROOT_DIR/index.html" > "${ROOT_DIR}/index.html.tmp"
    mv "${ROOT_DIR}/index.html.tmp" "$ROOT_DIR/index.html"
fi

echo "Entrypoint script completed successfully."

exec "$@"