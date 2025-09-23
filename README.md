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
Assuming that you have HS running locally, with a user `asdf2` and a resource `691cd6fc77e6403299bf5ea51ef4698f`
"move" the resource to the expected default:
```
export STARTING_RESOURCE_ID=691cd6fc77e6403299bf5ea51ef4698f
export DEFAULT_RESOURCE_ID=d7b526e24f7e449098b428ae9363f514
docker exec -it hydroshare python manage.py modify_resource_id $STARTING_RESOURCE_ID $DEFAULT_RESOURCE_ID
```

```
# the bucket is your hs username
export BUCKET=asdf2

mc alias set local-hydroshare http://localhost:9000 minioadmin minioadmin

mc cp example_metadata/dataset_metadata.json local-hydroshare/$BUCKET/md/$DEFAULT_RESOURCE_ID/

mc cp example_metadata/hs_user_meta.json local-hydroshare/$BUCKET/$DEFAULT_RESOURCE_ID/data/contents/
```