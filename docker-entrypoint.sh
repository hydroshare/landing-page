#!/bin/sh
ROOT_DIR=/srv/landing
# Replace env vars in files served by CADDY
for file in $ROOT_DIR/assets/*.js $ROOT_DIR/index.html;
do
    echo "Processing $file ...";
    # LC_ALL=C sed -i "" 's|VITE_APP_BASE_PLACEHOLDER|'${VITE_APP_BASE}'|g' $file
    sed -i 's|VITE_APP_BASE_PLACEHOLDER|'${VITE_APP_BASE}'|g' $file
done

exec "$@"