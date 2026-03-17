from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    supabase_jwt_secret: str
    frontend_url: str = "http://localhost:5173"
    # AWS Lambda PDF trigger
    aws_region: str = "ap-south-1"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    pdf_lambda_function_name: str = "adizes-pdf-generator"
    lambda_invoke_role_arn: str = ""  # If set, assume this role before invoking Lambda

    class Config:
        env_file = ".env"


settings = Settings()
