# HydroShare File-based Metadata Landing Page

## Getting Started

### Clone the repo, checkout this branch
```console
git clone https://github.com/hydroshare/landing-page
```

### Frontend for local development

The [.env.development](.env.development) is commited according to the [Vite standards](https://vite.dev/guide/env-and-mode#env-variables-and-modes). We recommend that you create a separate `frontend/.env.local` file and add any modifications you would like.

Then run the Vue app in the background (hmr enabled) using [PM2](https://pm2.io/) via the [Makefile](../Makefile):
```console
make up-landing
npx pm2 ls #(optionally, to list all pm2 services)
make logs-landing #(optionally to tail logs)
```


Or if you prefer, you can run the app using npm:
```console
npm install
npm run serve
```
Either way, the frontend will be available at http://localhost:5004/
More info is available in the [Main readme](../README.md)

## Formatting
```console
make format
```

### Create a dummy resource for landing page work
Assuming that you have HS running locally, with a user `asdf` and a resource `d7b526e24f7e449098b428ae9363f514`
"move" the resource to the expected default:

```
# the bucket is your hs username
export BUCKET=asdf
export DEFAULT_RESOURCE_ID=d7b526e24f7e449098b428ae9363f514

mc alias set local-hydroshare http://localhost:9000 cuahsi devpassword
docker exec -u hydro-service hydroshare python manage.py create_buckets asdf
mc cp example_metadata/dataset_metadata.json local-hydroshare/$BUCKET/$DEFAULT_RESOURCE_ID/.hsjsonld/
mc cp example_metadata/user_metadata.json local-hydroshare/$BUCKET/$DEFAULT_RESOURCE_ID/.hsmetadata/
```