"""Configuration management using Pydantic Settings."""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # OpenAI
    openai_api_key: str = Field(..., description="OpenAI API key")
    openai_model: str = Field("gpt-4o", description="OpenAI model name")

    # Email
    email_imap_host: str = Field("imap.gmail.com", description="IMAP host")
    email_imap_port: int = Field(993, description="IMAP port")
    email_smtp_host: str = Field("smtp.gmail.com", description="SMTP host")
    email_smtp_port: int = Field(587, description="SMTP port")
    email_address: str = Field("", description="Sender email address")
    email_password: str = Field("", description="Email password / app password")
    email_poll_interval: int = Field(60, description="Seconds between inbox polls")

    # Twilio
    twilio_account_sid: str = Field("", description="Twilio Account SID")
    twilio_auth_token: str = Field("", description="Twilio Auth Token")
    twilio_phone_number: str = Field("", description="Twilio outbound phone number")

    # Owner
    owner_phone_number: str = Field("", description="Owner's personal phone number")

    # Secretary identity
    secretary_name: str = Field("Alex", description="Name the assistant uses")


_settings: Settings | None = None


def get_settings() -> Settings:
    """Return the cached settings instance."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
