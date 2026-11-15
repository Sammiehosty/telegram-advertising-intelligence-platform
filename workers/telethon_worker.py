#!/usr/bin/env python3
"""
TeleAd Intelligence — Telethon worker (VPS companion).

Purpose
-------
The Next.js application orchestrates discovery and analytics; this Python
worker performs the live Telegram MTProto operations that browsers/Node
cannot. It is deliberately small and honest:

1.  First run prints a Telethon StringSession — paste it into
    Administration → Telegram API in the web app.
2.  `search <keyword>` resolves public channels via official MTProto calls
    (contacts.Search) and prints their public stats as JSON lines.
3.  `analyse <username> [days]` fetches recent public posts of a channel and
    prints per-post stats (views, reactions, forwards, comments) as JSON.

Rate-limit safety: FloodWaitError is respected (we sleep exactly as long as
Telegram asks), requests are throttled, and private entities are never
touched.

Usage
-----
    pip install -r workers/requirements.txt
    python workers/telethon_worker.py login          # prints StringSession
    python workers/telethon_worker.py search crypto  # JSONL of found channels
    python workers/telethon_worker.py analyse durov 30  # JSONL of posts

Environment: TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
from datetime import datetime, timedelta, timezone

from telethon import TelegramClient
from telethon.errors import FloodWaitError, ChannelPrivateError, UsernameNotOccupiedError
from telethon.sessions import StringSession
from telethon.tl.functions.contacts import SearchRequest

API_ID = int(os.environ.get("TELEGRAM_API_ID", "0"))
API_HASH = os.environ.get("TELEGRAM_API_HASH", "")
SESSION = os.environ.get("TELEGRAM_SESSION", "")

THROTTLE_SECONDS = 1.2  # conservative pacing between MTProto calls


async def _client() -> TelegramClient:
    client = TelegramClient(StringSession(SESSION or None), API_ID, API_HASH)
    await client.connect()
    return client


async def cmd_login() -> None:
    """Interactive: signs you in and prints a StringSession for the web app."""
    client = await _client()
    if not await client.is_user_authorized():
        await client.start()  # prompts for phone + code + optional 2FA
    print("\n=== Paste this StringSession into Administration → Telegram API ===")
    print(client.session.save())
    await client.disconnect()


async def cmd_search(keyword: str) -> None:
    client = await _client()
    try:
        while True:
            try:
                result = await client(SearchRequest(q=keyword, limit=100))
                break
            except FloodWaitError as e:
                await asyncio.sleep(e.seconds + 1)  # respect Telegram's cooldown
        for chat in result.chats:
            if not getattr(chat, "username", None):
                continue
            print(json.dumps({
                "username": chat.username,
                "title": chat.title,
                "tg_id": chat.id,
                "subscribers": getattr(chat, "participants_count", None),
                "broadcast": getattr(chat, "broadcast", False),
            }), flush=True)
    finally:
        await client.disconnect()


async def cmd_analyse(username: str, days: int) -> None:
    client = await _client()
    try:
        try:
            entity = await client.get_entity(username)
        except UsernameNotOccupiedError:
            print(json.dumps({"error": "username_not_found", "username": username}))
            return
        except ChannelPrivateError:
            print(json.dumps({"error": "channel_is_private", "username": username}))
            return

        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        async for msg in client.iter_messages(entity, limit=days * 60):
            if msg.date < cutoff:
                break
            comments = None
            try:
                comments = msg.replies.replies if msg.replies else None  # None = unavailable, never zero
            except AttributeError:
                pass
            reactions = None
            if msg.reactions:
                reactions = sum(r.count for r in msg.reactions.results)
            print(json.dumps({
                "message_id": msg.id,
                "date": msg.date.isoformat(),
                "text": (msg.text or "")[:500],
                "views": msg.views,
                "reactions": reactions,
                "comments": comments,
                "forwards": msg.forwards,
            }), flush=True)
            await asyncio.sleep(THROTTLE_SECONDS / 10)
    finally:
        await client.disconnect()


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        return
    cmd = sys.argv[1]
    if cmd == "login":
        asyncio.run(cmd_login())
    elif cmd == "search" and len(sys.argv) >= 3:
        asyncio.run(cmd_search(sys.argv[2]))
    elif cmd == "analyse":
        asyncio.run(cmd_analyse(sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 30))
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
