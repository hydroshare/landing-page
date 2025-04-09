from api.discover.app.routers.pubsub.router import GooglePubSubPushRequest, DiscoveryMessage
import json
import base64

def test_message_parsing():
    push_request = {
        "message": {
            "data": base64.b64encode(json.dumps({"resource_id": "abc", "removed": False}).encode("utf-8")),
            "messageId": "123"
        }
    }
    
    push_request = GooglePubSubPushRequest(**push_request)
    
    discovery_message = push_request.message.discovery_message()
    assert isinstance(discovery_message, DiscoveryMessage)
    assert discovery_message.resource_id == "abc"
    assert discovery_message.removed == False
