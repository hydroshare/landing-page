# HydroShare File-based Metadata Landing Page

## Getting Started

### Clone the repo, checkout this branch
```console
git clone https://github.com/hydroshare/landing-page
```

### Frontend for local development
```console
cp .env.template .env  #if you haven't already
npm install
npm run serve
```
The frontend will be available at http://localhost:5004/

### Create a dummy resource for landing page work
Assuming that you have HS running locally, with a user `asdf` and a resource `d7b526e24f7e449098b428ae9363f514`
"move" the resource to the expected default:

```
# the bucket is your hs username
export BUCKET=asdf

mc alias set local-hydroshare http://localhost:9000 cuahsi devpassword
docker exec -u hydro-service hydroshare python manage.py create_buckets asdf
mc cp example_metadata/dataset_metadata.json local-hydroshare/$BUCKET/$DEFAULT_RESOURCE_ID/.hsjsonld/
mc cp example_metadata/user_metadata.json local-hydroshare/$BUCKET/$DEFAULT_RESOURCE_ID/.hsmetadata/
```