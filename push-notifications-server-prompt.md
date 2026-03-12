# Prompt: Implement Web Push Notifications in the OriginChats Python Server

## Context

You are working on a decentralised Python-based WebSocket chat server that is part of the **OriginChats / Rotur** ecosystem. Each server instance is independently operated. Clients connect via `wss://` and exchange JSON messages.

The client (a Preact web app built with Vite) has already been updated to support Web Push notifications. Your task is to implement the server-side half of this feature.

---

## What Web Push Is

Web Push (RFC 8030) allows a server to send a push notification to a user's browser **even when the browser tab is closed**, as long as the browser itself is running. The flow is:

1. The client subscribes to push via the browser's `PushManager` API and obtains a **push subscription object** containing an `endpoint` URL and encryption keys.
2. The client sends this subscription to your server for storage.
3. When the user is offline (no active WebSocket connection) and an event that would notify them occurs (e.g. a `@mention` or DM), your server sends an HTTP POST to the subscription's `endpoint` URL (a URL hosted by the browser vendor — Chrome, Firefox, etc.).
4. The browser vendor delivers the push payload to the user's device, where the client's **service worker** wakes up and shows a notification.

---

## Prerequisites

Install the `pywebpush` library:

```bash
pip install pywebpush
```

Generate a VAPID key pair **once** and store it persistently (e.g. in a config file or environment variables). VAPID is required by all major browsers.

```bash
# Using the vapid CLI tool that ships with pywebpush:
vapid --gen
# This outputs private_key.pem and public_key.pem
# The public key also needs to be available in base64url format for the client
```

Alternatively, generate programmatically:

```python
from py_vapid import Vapid
vapid = Vapid()
vapid.generate_keys()
vapid.save_key("private_key.pem")
vapid.save_public_key("public_key.pem")
# Get the base64url-encoded public key string for sending to clients:
public_key_b64 = vapid.public_key.export_public_key()  # base64url string
```

Store `VAPID_PRIVATE_KEY_PATH`, `VAPID_PUBLIC_KEY_B64`, and `VAPID_CLAIMS_EMAIL` (e.g. `mailto:admin@yourserver.com`) as config/env values.

---

## Database Schema Changes

Add a table (or equivalent data store) to persist push subscriptions per user:

```sql
CREATE TABLE push_subscriptions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT NOT NULL,
    endpoint    TEXT NOT NULL UNIQUE,
    p256dh      TEXT NOT NULL,   -- client public key (from subscription.keys.p256dh)
    auth        TEXT NOT NULL,   -- auth secret (from subscription.keys.auth)
    server_url  TEXT,            -- optional: which server this sub was registered from
    created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE INDEX idx_push_subs_username ON push_subscriptions(username);
```

If you use a different data store (Redis, MongoDB, etc.), model accordingly — the key fields are `username`, `endpoint`, `p256dh`, and `auth`.

---

## New WebSocket Commands to Implement

The client sends these commands over the existing authenticated WebSocket connection. All commands arrive as JSON objects with a `cmd` field.

### 1. `push_get_vapid`

**Direction:** client → server  
**Payload:** `{ "cmd": "push_get_vapid" }`  
**Purpose:** Client is asking for the server's VAPID public key so it can call `PushManager.subscribe()`.

**Server response** (send back on the same connection):

```json
{
  "cmd": "push_vapid",
  "key": "<base64url-encoded VAPID public key>"
}
```

**Implementation:**

```python
case "push_get_vapid":
    await send_json(ws, {
        "cmd": "push_vapid",
        "key": VAPID_PUBLIC_KEY_B64  # your stored base64url public key
    })
```

---

### 2. `push_subscribe`

**Direction:** client → server  
**Payload:**

```json
{
  "cmd": "push_subscribe",
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/fcm/send/...",
    "keys": {
      "p256dh": "BNcR...",
      "auth": "tBHItJI..."
    }
  },
  "vapid_public_key": "<base64url string>"
}
```

**Purpose:** Register the client's push subscription for this authenticated user. Store it so the server can deliver push payloads when the user is offline.

**Server response:**

```json
{ "cmd": "push_subscribed", "success": true }
```

**Implementation:**

```python
case "push_subscribe":
    sub = msg["subscription"]
    endpoint = sub["endpoint"]
    p256dh = sub["keys"]["p256dh"]
    auth = sub["keys"]["auth"]
    username = current_user  # the authenticated username for this WS connection

    # Upsert: replace any existing subscription for this endpoint
    db.execute("""
        INSERT INTO push_subscriptions (username, endpoint, p256dh, auth)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(endpoint) DO UPDATE SET
            username = excluded.username,
            p256dh   = excluded.p256dh,
            auth     = excluded.auth
    """, (username, endpoint, p256dh, auth))
    db.commit()

    await send_json(ws, {"cmd": "push_subscribed", "success": True})
```

---

### 3. `push_unsubscribe`

**Direction:** client → server  
**Payload:**

```json
{
  "cmd": "push_unsubscribe",
  "endpoint": "https://fcm.googleapis.com/fcm/send/..."
}
```

**Purpose:** Remove a push subscription (user disabled offline push for this server).

**Implementation:**

```python
case "push_unsubscribe":
    endpoint = msg.get("endpoint")
    if endpoint:
        db.execute(
            "DELETE FROM push_subscriptions WHERE username = ? AND endpoint = ?",
            (current_user, endpoint)
        )
        db.commit()
```

No response required, but you may optionally send `{ "cmd": "push_unsubscribed", "success": true }`.

---

## Sending Push Notifications

### When to send

Send a push notification to a user when **all** of the following are true:

1. An event occurs that would trigger a notification for them (see below).
2. The user has **no active WebSocket connection** to this server (they are offline).
3. The user has at least one stored push subscription.

**Events that should trigger a push notification:**

- A new message in a channel where the user is `@mentioned` by username (e.g. `@alice`).
- A reply to a message the user sent.
- A new DM (if your server handles DMs).
- Any event matching the user's notification level setting — note: the client already stores `all`/`mentions`/`none` preference locally, but since the server doesn't know the client's setting, it is recommended to only push for **mentions and replies** by default. You may optionally add a mechanism for the client to communicate their preference.

### How to check if a user is online

```python
def is_user_online(username: str) -> bool:
    """Return True if the user has an active authenticated WS connection."""
    return username in active_connections  # your existing connection registry
```

### Sending the push payload with pywebpush

```python
from pywebpush import webpush, WebPushException
import json

def send_push_notification(username: str, title: str, body: str, data: dict):
    """Send a Web Push notification to all subscriptions for a user."""
    subs = db.execute(
        "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE username = ?",
        (username,)
    ).fetchall()

    payload = json.dumps({
        "title": title,
        "body": body,
        **data  # e.g. serverUrl, channelName
    })

    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": {
                        "p256dh": sub["p256dh"],
                        "auth":   sub["auth"],
                    },
                },
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY_PATH,  # path to private_key.pem
                vapid_claims={
                    "sub": "mailto:admin@yourserver.com",  # VAPID_CLAIMS_EMAIL
                },
            )
        except WebPushException as e:
            if e.response and e.response.status_code in (404, 410):
                # Subscription is expired or invalid — remove it
                db.execute(
                    "DELETE FROM push_subscriptions WHERE endpoint = ?",
                    (sub["endpoint"],)
                )
                db.commit()
            else:
                print(f"[Push] Failed to send to {sub['endpoint']}: {e}")
```

### Integration point — inside your message_new handler

```python
case "message_new":
    # ... your existing message handling (store message, broadcast to connected users) ...

    # After broadcasting to online users, check for offline recipients to push:
    mentioned_users = extract_mentions(msg["content"])  # parse @username patterns

    for mentioned_username in mentioned_users:
        if mentioned_username == sender:
            continue
        if not is_user_online(mentioned_username):
            send_push_notification(
                username=mentioned_username,
                title=f"#{channel_name} — {sender}",
                body=truncate(msg["content"], 120),
                data={
                    "serverUrl": YOUR_SERVER_HOSTNAME,  # e.g. "chats.mistium.com"
                    "channelName": channel_name,
                }
            )

    # Also check for reply-to notifications:
    if reply_to_id := msg.get("reply_to"):
        original = db.execute(
            "SELECT author FROM messages WHERE id = ?", (reply_to_id,)
        ).fetchone()
        if original and original["author"] != sender:
            if not is_user_online(original["author"]):
                send_push_notification(
                    username=original["author"],
                    title=f"#{channel_name} — {sender} replied",
                    body=truncate(msg["content"], 120),
                    data={
                        "serverUrl": YOUR_SERVER_HOSTNAME,
                        "channelName": channel_name,
                    }
                )
```

---

## Service Worker Push Handler (already implemented on the client)

The client's service worker (generated by `vite-plugin-pwa` / Workbox) listens for push events. The payload your server sends must be a JSON string matching this shape:

```json
{
  "title": "The notification title",
  "body": "The notification body text",
  "serverUrl": "chats.mistium.com",
  "channelName": "general"
}
```

The service worker will call `self.registration.showNotification(title, { body, data })` automatically. You do **not** need to modify the client service worker for basic notifications — just send the correct payload shape.

---

## Security Notes

- **VAPID keys**: Generate once, never rotate without re-subscribing all clients. Store the private key securely (not in source control).
- **Subscription validation**: Only accept `push_subscribe` commands from authenticated WebSocket connections. Never allow unauthenticated subscription registration.
- **Endpoint cleanup**: Always remove subscriptions that return HTTP 404 or 410 from the push service — these are expired or revoked subscriptions.
- **Payload size**: Web Push payloads are limited to **4 KB**. Keep `body` short (truncate to ~120 characters).
- **Rate limiting**: Consider rate-limiting push sends per user per minute to avoid spamming users or exhausting push service quotas.
- **TTL**: You can optionally set a `ttl` (time-to-live in seconds) on pushes via the `pywebpush` `ttl` parameter (default is 0, meaning deliver immediately or drop). For chat notifications, `ttl=86400` (24 hours) is reasonable.

---

## Summary of Changes Required

| Change                                                                | Location                          |
| --------------------------------------------------------------------- | --------------------------------- |
| Install `pywebpush`                                                   | `requirements.txt` / `pip`        |
| Generate & store VAPID key pair                                       | Config / env vars                 |
| Add `push_subscriptions` table                                        | Database schema migration         |
| Handle `push_get_vapid` command                                       | WebSocket message handler         |
| Handle `push_subscribe` command                                       | WebSocket message handler         |
| Handle `push_unsubscribe` command                                     | WebSocket message handler         |
| Call `send_push_notification()` on `message_new` for mentions/replies | `message_new` handler             |
| Clean up expired subscriptions (404/410 responses)                    | Inside `send_push_notification()` |
