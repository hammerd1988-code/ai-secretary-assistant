"""Background scheduler: periodically polls email and triages messages."""

from __future__ import annotations

import logging

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.schedulers.background import BackgroundScheduler

from .ai_engine import AIEngine, Priority
from .config import Settings, get_settings
from .email_handler import EmailHandler
from .sms_handler import SMSHandler

logger = logging.getLogger(__name__)


class SecretaryScheduler:
    """Orchestrates periodic email polling and triage."""

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._email = EmailHandler(self._settings)
        self._ai = AIEngine(self._settings)
        self._sms = SMSHandler(self._settings)

    def poll_and_triage(self) -> None:
        """Fetch unread emails, triage each one, and alert the owner for urgent items."""
        logger.info("Polling inbox…")
        try:
            messages = self._email.fetch_unread()
        except Exception as exc:
            logger.error("Failed to fetch emails: %s", exc)
            return

        for msg in messages:
            try:
                result = self._ai.triage_message(
                    f"Subject: {msg.subject}\n\n{msg.body}"
                )
                logger.info(
                    "Triaged email from %s — priority=%s summary=%r",
                    msg.sender,
                    result.priority,
                    result.summary,
                )
                if result.priority == Priority.URGENT:
                    alert = (
                        f"URGENT email from {msg.sender}:\n"
                        f"Subject: {msg.subject}\n"
                        f"Summary: {result.summary}"
                    )
                    self._sms.alert_owner(alert)

                if result.suggested_reply and result.priority != Priority.SPAM:
                    self._email.send_reply(
                        to_address=msg.sender,
                        subject=msg.subject,
                        body=result.suggested_reply,
                        in_reply_to=msg.message_id,
                    )

                self._email.mark_as_read(msg.uid)
            except Exception as exc:
                logger.error("Error processing email uid=%s: %s", msg.uid, exc)

    def run_blocking(self) -> None:
        """Start a blocking scheduler (runs in the foreground)."""
        scheduler = BlockingScheduler()
        scheduler.add_job(
            self.poll_and_triage,
            "interval",
            seconds=self._settings.email_poll_interval,
            id="email_poll",
        )
        logger.info(
            "Scheduler started -- polling every %d seconds",
            self._settings.email_poll_interval,
        )
        scheduler.start()

    def get_background_scheduler(self) -> BackgroundScheduler:
        """Return a configured BackgroundScheduler (caller must call .start())."""
        scheduler = BackgroundScheduler()
        scheduler.add_job(
            self.poll_and_triage,
            "interval",
            seconds=self._settings.email_poll_interval,
            id="email_poll",
        )
        return scheduler
