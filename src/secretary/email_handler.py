"""Email handler: poll inbox via IMAP and send replies via SMTP."""

from __future__ import annotations

import email
import imaplib
import logging
import smtplib
from dataclasses import dataclass
from email.mime.text import MIMEText

from .config import Settings, get_settings

logger = logging.getLogger(__name__)


@dataclass
class EmailMessage:
    uid: str
    sender: str
    subject: str
    body: str
    message_id: str


class EmailHandler:
    """Reads unread emails and sends replies."""

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()

    # ── IMAP helpers ──────────────────────────────────────────────────────────

    def _connect_imap(self) -> imaplib.IMAP4_SSL:
        conn = imaplib.IMAP4_SSL(
            self._settings.email_imap_host,
            self._settings.email_imap_port,
        )
        conn.login(self._settings.email_address, self._settings.email_password)
        return conn

    def fetch_unread(self) -> list[EmailMessage]:
        """Return all unread messages from INBOX."""
        conn = self._connect_imap()
        conn.select("INBOX")
        _, data = conn.search(None, "UNSEEN")
        uids = data[0].split()
        messages: list[EmailMessage] = []
        for uid in uids:
            _, msg_data = conn.fetch(uid, "(RFC822)")
            raw = msg_data[0][1]
            msg = email.message_from_bytes(raw)  # type: ignore[arg-type]
            body = _extract_body(msg)
            messages.append(
                EmailMessage(
                    uid=uid.decode(),
                    sender=msg.get("From", ""),
                    subject=msg.get("Subject", "(no subject)"),
                    body=body,
                    message_id=msg.get("Message-ID", ""),
                )
            )
        conn.logout()
        return messages

    def mark_as_read(self, uid: str) -> None:
        """Mark a message as read by UID."""
        conn = self._connect_imap()
        conn.select("INBOX")
        conn.store(uid, "+FLAGS", "\\Seen")
        conn.logout()

    # ── SMTP helpers ──────────────────────────────────────────────────────────

    def send_reply(
        self,
        to_address: str,
        subject: str,
        body: str,
        in_reply_to: str = "",
    ) -> None:
        """Send a plain-text email reply."""
        msg = MIMEText(body, "plain")
        msg["From"] = self._settings.email_address
        msg["To"] = to_address
msg["Subject"] = subject if subject.lower().startswith("re:") else f"Re: {subject}"
        if in_reply_to:
            msg["In-Reply-To"] = in_reply_to
            msg["References"] = in_reply_to

        with smtplib.SMTP(
            self._settings.email_smtp_host,
            self._settings.email_smtp_port,
        ) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(self._settings.email_address, self._settings.email_password)
            smtp.sendmail(self._settings.email_address, to_address, msg.as_string())
        logger.info("Sent reply to %s (subject: %s)", to_address, subject)


def _extract_body(msg: email.message.Message) -> str:
    """Extract plain-text body from an email.message.Message."""
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            disposition = str(part.get("Content-Disposition", ""))
            if content_type == "text/plain" and "attachment" not in disposition:
                payload = part.get_payload(decode=True)
                if payload:
                    return payload.decode(errors="replace")
        return ""
    payload = msg.get_payload(decode=True)
    if payload:
        return payload.decode(errors="replace")
    return ""
