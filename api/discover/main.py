import s3fs
from contextlib import asynccontextmanager
from fastapi import FastAPI

from discover.app.routers.eventing import router as eventing_router
from discover.config import get_settings
from motor.motor_asyncio import AsyncIOMotorClient

# TODO: get oauth working with swagger/redoc
# Setting the base url for swagger docs
# https://github.com/tiangolo/fastapi/pull/1547
# https://swagger.io/docs/specification/api-host-and-base-path/ma
# https://fastapi.tiangolo.com/how-to/configure-swagger-ui/
# https://github.com/tiangolo/fastapi/pull/499


@asynccontextmanager
async def on_startup(app: FastAPI):
    app.db = AsyncIOMotorClient(get_settings().mongo_url)
    app.mongodb = app.db[get_settings().mongo_database]
    app.s3 = s3fs.S3FileSystem(endpoint_url=get_settings().s3_endpoint_url)

app = FastAPI()

app.include_router(
    eventing_router,
    prefix="/api/pubsub",
    tags=["eventing"],
)