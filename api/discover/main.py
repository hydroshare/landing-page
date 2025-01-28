import os
import subprocess

import motor
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from subsetter.app.routers.discovery import router as discovery_router
from subsetter.config import get_settings

# TODO: get oauth working with swagger/redoc
# Setting the base url for swagger docs
# https://github.com/tiangolo/fastapi/pull/1547
# https://swagger.io/docs/specification/api-host-and-base-path/ma
# https://fastapi.tiangolo.com/how-to/configure-swagger-ui/
# https://github.com/tiangolo/fastapi/pull/499
swagger_params = {
    "withCredentials": True,
    "oauth2RedirectUrl": cuahsi_oauth_client.authorize_endpoint,
    "swagger_ui_client_id": cuahsi_oauth_client.client_id,
}

app = FastAPI(servers=[{"url": get_settings().vite_app_api_url}], swagger_ui_parameters=swagger_params)

origins = [get_settings().allow_origins]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

parent_dir = os.path.dirname(__file__)
static_dir = os.path.join(parent_dir, "app/schemas")
app.mount("/api/schemas", StaticFiles(directory=static_dir), name="schemas")

app.include_router(
    discovery_router,
    prefix="/api/discovery",
    tags=["discovery"],
)

@app.on_event("startup")
async def on_startup():
    app.db = motor.motor_asyncio.AsyncIOMotorClient(get_settings().mongo_url)
    app.mongodb = app.db[get_settings().mongo_database]

