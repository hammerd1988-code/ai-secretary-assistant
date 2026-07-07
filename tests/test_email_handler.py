"""Tests for secretary.email_handler."""

from __future__ import annotations

import email as email_lib
from unittest.mock import MagicMock, patch

import pytest

from secretary.config import Settings
from secretary.email_handler import EmailHandler, _extract_body


@pytest.fixture
def settings():
    return Settings(
        openai_api_key="sk-test",
        email_address="sender@example.com",
        email_password="pass",
    )


@pytest.fixture
def handler(settings):
    return EmailHandler(settings)


class TestExtractBody:
    def test_plain_text_message(self):
        msg = email_lib.message_from_string(
            "Content-Type: text/plain\r\n\r\nHello world"
        )
        assert _extract_body(msg) == "Hello world"

    def test_multipart_prefers_plain_text(self):
        raw = (
            "Content-Type: multipart/alternative; boundary=\"bound\"\r\n\r\n"
            "--bound\r\n"
            "Content-Type: text/plain\r\n\r\nPlain text\r\n"
            "--bound\r\n"
            "Content-Type: text/html\r\n\r\n<b>HTML text</b>\r\n"
            "--bound--"
        )
        msg = email_lib.message_from_string(raw)
        body = _extract_body(msg)
        assert "Plain text" in body

    def test_empty_message_returns_empty_string(self):
        msg = email_lib.message_from_string("Content-Type: text/plain\r\n\r\n")
        assert _extract_body(msg) == ""


class TestSendReply:
    def test_send_reply_adds_re_prefix(self, handler):
        with patch("secretary.email_handler.smtplib.SMTP") as mock_smtp_cls:
            mock_smtp = MagicMock()
            mock_smtp_cls.return_value.__enter__.return_value = mock_smtp

            handler.send_reply(
                to_address="recipient@example.com",
                subject="Meeting tomorrow",
                body="Thanks for reaching out.",
            )

            args, _ = mock_smtp.sendmail.call_args
            raw_msg = args[2]
            assert "Re: Meeting tomorrow" in raw_msg

    def test_send_reply_does_not_double_re(self, handler):
        with patch("secretary.email_handler.smtplib.SMTP") as mock_smtp_cls:
            mock_smtp = MagicMock()
            mock_smtp_cls.return_value.__enter__.return_value = mock_smtp

            handler.send_reply(
                to_address="recipient@example.com",
                subject="Re: Meeting tomorrow",
                body="No worries.",
            )

            args, _ = mock_smtp.sendmail.call_args
            raw_msg = args[2]
            assert raw_msg.count("Re:") == 1
