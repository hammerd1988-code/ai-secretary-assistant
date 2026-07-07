"""SMS handler: send and receive SMS messages via Twilio."""

from __future__ import annotations

import logging

from twilio.rest import Client

from .config import Settings, get_settings

logger = logging.getLogger(__name__)


class SMSHandler:
    """Send SMS alerts to the owner and respond to inbound SMS webhooks."""

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._client = Client(
            self._settings.twilio_account_sid,
            self._settings.twilio_auth_token,
        )

    def send_sms(self, to: str, body: str) -> str:
        """Send an SMS and return the Twilio message SID."""
        message = self._client.messages.create(
            body=body,
            from_=self._settings.twilio_phone_number,
            to=to,
        )
        logger.info("SMS sent — SID: %s", message.sid)
        return message.sid

    def alert_owner(self, text: str) -> str:
        """Send an urgent alert SMS to the owner's phone number."""
        return self.send_sms(self._settings.owner_phone_number, text)

    @staticmethod
    def parse_inbound(form_data: dict) -> dict[str, str]:
        """Extract useful fields from a Twilio inbound SMS webhook payload."""
        return {
            "from": form_data.get("From", ""),
            "to": form_data.get("To", ""),
            "body": form_data.get("Body", ""),
            "message_sid": form_data.get("MessageSid", ""),
        }
