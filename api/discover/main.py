from fastapi import FastAPI

#from discover.app.routers.discovery import router as discovery_router
from discover.app.routers.pubsub import router as pubsub_router
from discover.config import get_settings

# TODO: get oauth working with swagger/redoc
# Setting the base url for swagger docs
# https://github.com/tiangolo/fastapi/pull/1547
# https://swagger.io/docs/specification/api-host-and-base-path/ma
# https://fastapi.tiangolo.com/how-to/configure-swagger-ui/
# https://github.com/tiangolo/fastapi/pull/499

app = FastAPI()

app.include_router(
    pubsub_router,
    prefix="/api/pubsub",
    tags=["pubsub"],
)
