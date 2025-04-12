from functools import lru_cache

# from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# had to use load_dotenv() to get the env variables to work during testing
# load_dotenv()


class Settings(BaseSettings):
    argo_host: str
    argo_namespace: str
    argo_bearer_token: str

    s3_endpoint_url: str = 'https://s3.hydroshare.org'
    mongo_url: str
    mongo_database: str

    hydroshare_api_authorization: str
    hydroshare_host: str

@lru_cache()
def get_settings() -> Settings:
    return Settings()
