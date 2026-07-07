"""CLI entry-point for the AI Secretary Assistant.

Usage
-----
Run the background email scheduler (blocking):

    python -m secretary.main scheduler

Run the Twilio webhook server (SMS + voice):

    python -m secretary.main server [--port PORT]
"""

from __future__ import annotations

import argparse
import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def run_scheduler() -> None:
    from .scheduler import SecretaryScheduler

    SecretaryScheduler().run_blocking()


def run_server(port: int = 8080) -> None:
    """Start the Flask webhook server for Twilio SMS and voice callbacks."""
    from flask import Flask, Response, request

    from .ai_engine import AIEngine
    from .config import get_settings
    from .sms_handler import SMSHandler
    from .voice_handler import VoiceHandler

    app = Flask(__name__)
    settings = get_settings()
    ai = AIEngine(settings)
    sms = SMSHandler(settings)
    voice = VoiceHandler(settings)

    @app.route("/sms/inbound", methods=["POST"])
def sms_inbound() -> Response:
        from twilio.request_validator import RequestValidator

        validator = RequestValidator(settings.twilio_auth_token)
        signature = request.headers.get("X-Twilio-Signature", "")
        if not validator.validate(request.url, request.form, signature):
            logger.warning("Rejected SMS webhook with invalid Twilio signature")
            return Response("Forbidden", status=403)

        payload = SMSHandler.parse_inbound(request.form)
        caller = payload["from"]
        body = payload["body"]
        logger.info("Inbound SMS from %s: %r", caller, body)

        result = ai.triage_message(body)
        reply_body = result.suggested_reply or "Thank you for your message."
        sms.send_sms(caller, reply_body)
        return Response("", status=204)

    @app.route("/voice/inbound", methods=["POST"])
    def voice_inbound() -> Response:
        action_url = request.url_root.rstrip("/") + "/voice/gather"
        twiml = voice.greeting_twiml(action_url)
        return Response(twiml, content_type="text/xml")

    @app.route("/voice/gather", methods=["POST"])
def voice_gather() -> Response:
        from twilio.request_validator import RequestValidator

        validator = RequestValidator(settings.twilio_auth_token)
        signature = request.headers.get("X-Twilio-Signature", "")
        if not validator.validate(request.url, request.form, signature):
            logger.warning("Rejected voice gather webhook with invalid Twilio signature")
            return Response("Forbidden", status=403)

        caller_speech = request.form.get("SpeechResult", "")
        caller = request.form.get("From", "unknown")
        logger.info("Caller %s said: %r", caller, caller_speech)

        spoken_reply = ai.voice_response(caller_speech)
        twiml = voice.reply_twiml(spoken_reply)
        return Response(twiml, content_type="text/xml")
    @app.route("/voice/recording", methods=["POST"])
def voice_recording() -> Response:
        from twilio.request_validator import RequestValidator

        validator = RequestValidator(settings.twilio_auth_token)
        signature = request.headers.get("X-Twilio-Signature", "")
        if not validator.validate(request.url, request.form, signature):
            logger.warning("Rejected voice recording webhook with invalid Twilio signature")
            return Response("Forbidden", status=403)

        transcription = request.form.get("TranscriptionText", "(no transcription)")
        caller = request.form.get("From", "unknown")
        logger.info("Recording from %s: %r", caller, transcription)

        alert = f"Voicemail from {caller}:\n{transcription}"
        sms.alert_owner(alert)
        return Response("", status=204)

    logger.info("Starting webhook server on port %d", port)
    app.run(host="0.0.0.0", port=port)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        prog="secretary",
        description="AI Secretary Assistant",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("scheduler", help="Run the background email scheduler")

    server_parser = sub.add_parser("server", help="Run the Twilio webhook server")
    server_parser.add_argument(
        "--port",
        type=int,
        default=8080,
        help="Port to listen on (default: 8080)",
    )

    args = parser.parse_args(argv)

    if args.command == "scheduler":
        run_scheduler()
    elif args.command == "server":
        run_server(port=args.port)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
