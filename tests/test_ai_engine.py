"""Tests for secretary.ai_engine."""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest

from secretary.ai_engine import AIEngine, Priority, TriageResult
from secretary.config import Settings


@pytest.fixture
def settings():
    return Settings(
        openai_api_key="sk-test",
        email_address="test@example.com",
        email_password="password",
    )


@pytest.fixture
def engine(settings):
    with patch("secretary.ai_engine.OpenAI"):
        return AIEngine(settings)


class TestTriageMessage:
    def test_urgent_classification(self, engine):
        payload = json.dumps(
            {
                "priority": "urgent",
                "summary": "Server is down",
                "suggested_reply": "We are looking into it.",
            }
        )
        engine._client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content=payload))]
        )
        result = engine.triage_message("The production server crashed!")
        assert result.priority == Priority.URGENT
        assert result.summary == "Server is down"
        assert "looking into it" in result.suggested_reply

    def test_spam_classification(self, engine):
        payload = json.dumps(
            {
                "priority": "spam",
                "summary": "Newsletter",
                "suggested_reply": "",
            }
        )
        engine._client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content=payload))]
        )
        result = engine.triage_message("Subscribe to our newsletter!")
        assert result.priority == Priority.SPAM

    def test_malformed_json_returns_informational(self, engine):
        engine._client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="not json"))]
        )
        result = engine.triage_message("Some message")
        assert result.priority == Priority.INFORMATIONAL
        assert result.summary == "(could not parse AI response)"

    def test_unknown_priority_defaults_to_informational(self, engine):
        payload = json.dumps(
            {
                "priority": "unknown_value",
                "summary": "Something",
                "suggested_reply": "Reply",
            }
        )
        engine._client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content=payload))]
        )
        result = engine.triage_message("Some message")
        assert result.priority == Priority.INFORMATIONAL


class TestDraftReply:
    def test_returns_reply_text(self, engine):
        engine._client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="Hello, thanks for reaching out."))]
        )
        reply = engine.draft_reply("Can we schedule a meeting?")
        assert "Hello" in reply

    def test_empty_content_returns_empty_string(self, engine):
        engine._client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content=None))]
        )
        reply = engine.draft_reply("Something")
        assert reply == ""


class TestVoiceResponse:
    def test_returns_spoken_text(self, engine):
        engine._client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="Sure, I can take a message."))]
        )
        response = engine.voice_response("I'd like to leave a message.")
        assert "message" in response
