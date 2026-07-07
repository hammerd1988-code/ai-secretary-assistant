# AI Secretary Assistant

An autonomous AI secretary that manages your incoming text messages and emails, with optional real-time voice-call answering that can take messages on your behalf — all while sounding completely human.

---

## Features

- **Email management** — polls your inbox via IMAP, understands intent with GPT-4o, and drafts or sends replies automatically
- **SMS handling** — receives and responds to inbound SMS through Twilio; routes urgent messages for your attention
- **Voice call answering** — answers calls via a Twilio phone number, greets callers naturally, captures their message, and sends you a summary
- **Priority triage** — classifies every incoming message (urgent / informational / spam) and only alerts you for things that matter
- **Pluggable AI engine** — powered by the OpenAI Chat Completions API; swap in any compatible model by changing one env variable
- **Background scheduler** — APScheduler polls email on a configurable interval so nothing is missed

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        AI Secretary                             │
│                                                                 │
│  ┌─────────────┐   ┌─────────────┐   ┌──────────────────────┐  │
│  │EmailHandler │   │ SMSHandler  │   │   VoiceHandler       │  │
│  │  (IMAP/SMTP)│   │  (Twilio)   │   │   (Twilio TwiML)     │  │
│  └──────┬──────┘   └──────┬──────┘   └──────────┬───────────┘  │
│         │                 │                      │              │
│         └─────────────────┼──────────────────────┘              │
│                           │                                     │
│                    ┌──────▼──────┐                              │
│                    │  AIEngine   │   (OpenAI Chat Completions)  │
│                    └──────┬──────┘                              │
│                           │                                     │
│                    ┌──────▼──────┐                              │
│                    │  Scheduler  │   (APScheduler)              │
│                    └─────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- Python 3.11+
- A Twilio account (for SMS / voice features)
- An OpenAI API key

### Installation

```bash
git clone https://github.com/hammerd1988-code/ai-secretary-assistant.git
cd ai-secretary-assistant
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
```

### Configuration

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_MODEL` | Model name (default: `gpt-4o`) |
| `EMAIL_IMAP_HOST` | IMAP server hostname |
| `EMAIL_SMTP_HOST` | SMTP server hostname |
| `EMAIL_ADDRESS` | Your email address |
| `EMAIL_PASSWORD` | Your email password / app password |
| `EMAIL_POLL_INTERVAL` | Seconds between inbox checks (default: `60`) |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token |
| `TWILIO_PHONE_NUMBER` | Your Twilio phone number |
| `OWNER_PHONE_NUMBER` | Your personal phone number for alerts |
| `SECRETARY_NAME` | Name the assistant uses (default: `Alex`) |

### Running

```bash
# Start the background scheduler (email polling)
python -m secretary.main scheduler

# Start the Twilio webhook server (SMS + voice)
python -m secretary.main server --port 8080
```

---

## Project Structure

```
ai-secretary-assistant/
├── src/
│   └── secretary/
│       ├── __init__.py
│       ├── config.py          # Pydantic settings loaded from .env
│       ├── ai_engine.py       # OpenAI Chat Completions wrapper
│       ├── email_handler.py   # IMAP poller + SMTP sender
│       ├── sms_handler.py     # Twilio SMS send / receive
│       ├── voice_handler.py   # Twilio TwiML voice responses
│       ├── scheduler.py       # APScheduler job definitions
│       └── main.py            # CLI entry-point
├── tests/
│   ├── test_ai_engine.py
│   ├── test_email_handler.py
│   └── test_sms_handler.py
├── .env.example
├── .gitignore
├── pyproject.toml
└── README.md
```

---

## Running Tests

```bash
pytest -v
```

---

## License

MIT

