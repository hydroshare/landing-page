from fastapi import APIRouter

from typing import Any
import requests

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

def metadata_extraction_submission_body(input_bucket: str, output_bucket: str, resource_id: str):
    return {
        "resourceKind": "WorkflowTemplate",
        "resourceName": "metadata-extractor-hydroshare-discovery",
        "submitOptions": {
            "parameters": [f"input-bucket={input_bucket}", f"output_bucket={output_bucket}", f"resource-id={resource_id}"],
        },
    }

@router.post("/resource/extract")
async def resource_extract(push_request: GooglePubSubPushRequest):
    message_data: DiscoveryMessage = push_request.message.discovery_message()
    url = f"https://{get_settings().hydroshare_host}/hsapi/resource/{message_data.resource_id}/quota_holder_bucket_name/"
    credentials = get_settings().hydroshare_api_authorization
    resource_bucket = requests.get(url, headers={'Authorization': f'Basic {credentials}'}).text
    
    api_instance.submit_workflow(
        namespace=get_settings().argo_namespace,
        body=metadata_extraction_submission_body(resource_bucket,
                                                 "extracted-hydroshare-metadata",
                                                 message_data.resource_id),
        _preload_content=False
    )
