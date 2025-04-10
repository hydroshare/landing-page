from functools import lru_cache

# from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# had to use load_dotenv() to get the env variables to work during testing
# load_dotenv()


class Settings(BaseSettings):
    argo_host: str
    argo_namespace: str
    argo_bearer_token: str

    mongo_url: str = None
    mongo_database: str = None

    hydroshare_mongo_url: str = None
    hydroshare_mongo_database: str = None

    hydroshare_api_authorization: str
    hydroshare_host: str

    oauth2_client_id: str = None
    oauth2_client_secret: str = None
    oauth2_redirect_url: str = None
    vite_oauth2_redirect_url: str = None
    vite_app_api_url: str = None
    allow_origins: str = None

    minio_access_key: str = None
    minio_secret_key: str = None
    minio_api_url: str = None

    cloud_run: bool = False

    OIDC_BASE_URL: str = None

    @property
    def user_info_endpoint(self):
        return self.OIDC_BASE_URL + "userinfo"

    @property
    def authorize_endpoint(self):
        return self.OIDC_BASE_URL + "auth"

    @property
    def access_token_endpoint(self):
        return self.OIDC_BASE_URL + "token"

    @property
    def refresh_token_endpoint(self):
        # TODO look up refresh token endpoint
        return self.OIDC_BASE_URL + "token"

    @property
    def revoke_token_endpoint(self):
        return self.OIDC_BASE_URL + "revoke"

    @property
    def revocation_endpoint_auth_method(self):
        return "client_secret_basic"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
