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
The frontend will be available at http://localhost:8080/

### Create a dummy resource for landing page work
Assuming that you have HS running locally, with a user `asdf2` and a resource `691cd6fc77e6403299bf5ea51ef4698f`
"move" the resource to the expected default:
```
export STARTING_RESOURCE_ID=691cd6fc77e6403299bf5ea51ef4698f
export DEFAULT_RESOURCE_ID=691cd6fc77e6403299bf5ea51ef4698f
docker exec -it hydroshare python manage.py modify_resource_id $STARTING_RESOURCE_ID $DEFAULT_RESOURCE_ID
```

```
# the bucket is your hs username
export BUCKET=asdf2

docker exec -it hydroshare mc cp example_metadata/hs_user_meta.json hydroshare/$BUCKET/md/$DEFAULT_RESOURCE_ID/

docker exec -it hydroshare mc cp example_metadata/dataset_metadata.json hydroshare/$BUCKET/$DEFAULT_RESOURCE_ID/data/contents/
```