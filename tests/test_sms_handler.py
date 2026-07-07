"""Tests for secretary.sms_handler."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from secretary.config import Settings
from secretary.sms_handler import SMSHandler


@pytest.fixture
def settings():
    return Settings(
        openai_api_key="sk-test",
        twilio_account_sid="ACtest",
        twilio_auth_token="authtoken",
        twilio_phone_number="+15551234567",
        owner_phone_number="+15559876543",
    )


@pytest.fixture
def handler(settings):
    with patch("secretary.sms_handler.Client"):
        return SMSHandler(settings)


class TestSendSMS:
    def test_returns_message_sid(self, handler):
        handler._client.messages.create.return_value = MagicMock(sid="SM123")
        sid = handler.send_sms("+15550000000", "Hello!")
        assert sid == "SM123"

    def test_uses_configured_from_number(self, handler, settings):
        handler._client.messages.create.return_value = MagicMock(sid="SM456")
        handler.send_sms("+15550000000", "Test")
        _, kwargs = handler._client.messages.create.call_args
        assert kwargs["from_"] == settings.twilio_phone_number


class TestAlertOwner:
    def test_sends_to_owner_number(self, handler, settings):
        handler._client.messages.create.return_value = MagicMock(sid="SM789")
        handler.alert_owner("Urgent: server down")
        _, kwargs = handler._client.messages.create.call_args
        assert kwargs["to"] == settings.owner_phone_number


class TestParseInbound:
    def test_parses_standard_twilio_payload(self):
        form = {
            "From": "+15551111111",
            "To": "+15552222222",
            "Body": "Hello there",
            "MessageSid": "SMabc",
        }
        parsed = SMSHandler.parse_inbound(form)
        assert parsed["from"] == "+15551111111"
        assert parsed["body"] == "Hello there"
        assert parsed["message_sid"] == "SMabc"

    def test_handles_missing_fields_gracefully(self):
        parsed = SMSHandler.parse_inbound({})
        assert parsed["from"] == ""
        assert parsed["body"] == ""
        assert parsed["message_sid"] == ""
