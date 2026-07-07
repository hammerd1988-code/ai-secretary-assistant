"""Voice call handler: generate TwiML responses for Twilio voice webhooks."""

from __future__ import annotations

import logging

from twilio.twiml.voice_response import Gather, Say, VoiceResponse

from .config import Settings, get_settings

logger = logging.getLogger(__name__)


class VoiceHandler:
    """Build TwiML responses for inbound voice calls."""

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()

    def greeting_twiml(self, gather_action_url: str) -> str:
        """
        Return TwiML that greets the caller and begins speech recognition.

        Parameters
        ----------
        gather_action_url:
            The URL Twilio should POST the recognized speech to.
        """
        response = VoiceResponse()
        gather = Gather(
            input="speech",
            action=gather_action_url,
            method="POST",
            speech_timeout="auto",
            language="en-US",
        )
        gather.say(
            f"Hello, you've reached {self._settings.secretary_name}, "
            "an AI assistant. How can I help you today?",
            voice="Polly.Joanna",
        )
        response.append(gather)
        # Fallback if the caller says nothing
        response.say("I didn't catch that. Please call back and try again.")
        return str(response)

    def reply_twiml(self, spoken_text: str) -> str:
        """
        Return TwiML that speaks *spoken_text* to the caller and hangs up.

        Parameters
        ----------
        spoken_text:
            The text the AI engine produced in response to the caller.
        """
        response = VoiceResponse()
        response.say(spoken_text, voice="Polly.Joanna")
        response.hangup()
        return str(response)

    def take_message_twiml(self, recording_action_url: str) -> str:
        """
        Return TwiML that asks the caller to leave a message and records it.

        Parameters
        ----------
        recording_action_url:
            The URL Twilio should POST the recording metadata to.
        """
        response = VoiceResponse()
        response.say(
            "Please leave your message after the tone and press pound when finished.",
            voice="Polly.Joanna",
        )
        response.record(
            action=recording_action_url,
            method="POST",
            finish_on_key="#",
            max_length=120,
            transcribe=True,
        )
        response.say("Thank you for your message. Goodbye!", voice="Polly.Joanna")
        response.hangup()
        return str(response)
