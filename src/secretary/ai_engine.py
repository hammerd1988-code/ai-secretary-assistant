"""OpenAI-powered AI engine for the secretary assistant."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import Enum

from openai import OpenAI

from .config import Settings, get_settings

logger = logging.getLogger(__name__)


class Priority(str, Enum):
    URGENT = "urgent"
    INFORMATIONAL = "informational"
    SPAM = "spam"


@dataclass
class TriageResult:
    priority: Priority
    summary: str
    suggested_reply: str


_TRIAGE_SYSTEM_PROMPT = """\
You are {name}, a professional AI secretary. Your job is to triage incoming messages.

For every message you receive, respond with a JSON object with exactly these fields:
  "priority": one of "urgent", "informational", or "spam"
  "summary":  a single sentence summarizing what the sender wants
  "suggested_reply": a polite, professional reply on behalf of your employer

Rules:
- Mark a message "urgent" only if it requires a same-day response or describes an emergency.
- Mark obvious marketing, newsletters, or automated notifications as "spam".
- Everything else is "informational".
"""

_REPLY_SYSTEM_PROMPT = """\
You are {name}, a professional AI secretary. Write a short, polite, professional reply \
to the following message on behalf of your employer. \
Do not reveal that you are an AI unless directly asked.
"""

_VOICE_GREETING_PROMPT = """\
You are {name}, an AI secretary answering the phone on behalf of your employer. \
Greet the caller warmly, ask how you can help, and offer to take a message. \
Keep responses short and natural — this will be spoken aloud via text-to-speech.
"""


class AIEngine:
    """Wrapper around the OpenAI Chat Completions API."""

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._client = OpenAI(api_key=self._settings.openai_api_key)

    def _chat(self, system: str, user: str, json_mode: bool = False) -> str:
        kwargs: dict = {
            "model": self._settings.openai_model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
response = self._client.chat.completions.create(**kwargs)
        if not getattr(response, "choices", None):
            logger.warning("OpenAI response had no choices")
            return ""
        return response.choices[0].message.content or ""

    def triage_message(self, message: str) -> TriageResult:
        """Classify a message and generate a suggested reply."""
        import json

        system = _TRIAGE_SYSTEM_PROMPT.format(name=self._settings.secretary_name)
        raw = self._chat(system, message, json_mode=True)
try:
            data = json.loads(raw)
        except json.JSONDecodeError as exc:
            logger.warning("Failed to parse triage response JSON: %s", exc)
            return TriageResult(
                priority=Priority.INFORMATIONAL,
                summary="(could not parse AI response)",
                suggested_reply="",
            )

        try:
            priority = Priority(data.get("priority", "informational"))
        except ValueError:
            priority = Priority.INFORMATIONAL

        return TriageResult(
            priority=priority,
            summary=data.get("summary", ""),
            suggested_reply=data.get("suggested_reply", ""),
        )

    def draft_reply(self, incoming_message: str) -> str:
        """Draft a standalone reply to a message."""
        system = _REPLY_SYSTEM_PROMPT.format(name=self._settings.secretary_name)
        return self._chat(system, incoming_message)

    def voice_response(self, caller_speech: str) -> str:
        """Generate a spoken response to what a caller just said."""
        system = _VOICE_GREETING_PROMPT.format(name=self._settings.secretary_name)
        return self._chat(system, caller_speech)
