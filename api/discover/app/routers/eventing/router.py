from fastapi import APIRouter, Request

from typing import Any
import requests
import os
import json

from pydantic import BaseModel, Base64Str
from argo_workflows import Configuration, ApiClient
from argo_workflows.api import workflow_service_api

from config import get_settings

NAMESPACE = 'workflows'
OUTPUT_BASE_PATH = "argo_workflows"

configuration = Configuration(host=get_settings().argo_host)
configuration.api_key['BearerToken'] = get_settings().argo_bearer_token

api_client = ApiClient(configuration)
api_instance = workflow_service_api.WorkflowServiceApi(api_client)

class DiscoveryMessage(BaseModel):
    resource_id: str
    removed: bool

class GooglePubSubMessage(BaseModel):
    data: Base64Str
    messageId: str
    attributes: Any = None

    def discovery_message(self) -> DiscoveryMessage:
        return DiscoveryMessage.model_validate_json(self.data)

class GooglePubSubPushRequest(BaseModel):
    message: GooglePubSubMessage

router = APIRouter()

def metadata_extraction_submission_body(input_bucket: str, resource_id: str):
    return {
        "resourceKind": "WorkflowTemplate",
        "resourceName": "metadata-extractor-hydroshare-discovery",
        "submitOptions": {
            "parameters": [f"input-bucket={input_bucket}", f"resource-id={resource_id}"],
        },
    }

@router.post("/resource/extract")
async def resource_extract(push_request: GooglePubSubPushRequest):
    message_data: DiscoveryMessage = push_request.message.discovery_message()
    url = f"https://{get_settings().hydroshare_host}/hsapi/resource/{message_data.resource_id}/quota_holder_bucket_name/"
    credentials = get_settings().hydroshare_api_authorization
    resource_bucket = requests.get(url, headers={'Authorization': f'Basic {credentials}'}).text
    
    if not message_data.removed:
        api_instance.submit_workflow(
            namespace=get_settings().argo_namespace,
            body=metadata_extraction_submission_body(resource_bucket,
                                                    message_data.resource_id),
            _preload_content=False
        )

class CloudStorageMessage(BaseModel):
    bucket: str
    name: str

@router.post("/resource/collect")
async def resource_collect(request: Request, cloud_storage_message: CloudStorageMessage):
    bucket_id = cloud_storage_message.bucket
    object_name = cloud_storage_message.name
    filepath = os.path.join(bucket_id, object_name)
    with request.app.s3.open(filepath) as f:
        metadata_json = json.loads(f.read())
        metadata_json['_s3_filepath'] = filepath
    await request.app.mongodb["discovery"].find_one_and_replace({"url": metadata_json["url"]}, metadata_json, upsert=True)

@router.post("/resource/remove")
async def resource_collect(request: Request, cloud_storage_message: CloudStorageMessage):
    bucket_id = cloud_storage_message.bucket
    object_name = cloud_storage_message.name
    filepath = os.path.join(bucket_id, object_name)
    await request.app.mongodb["discovery"].delete_one({"_s3_filepath": filepath})
