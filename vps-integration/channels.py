"""
channels.py — fetch the tracked YouTube channel list from the dashboard API.

Copy this file into your VPS Flask project, then replace your hardcoded
channel list (e.g. CHANNELS = ["@aiDotEngineer", ...]) with:

    from channels import get_channel_handles
    CHANNELS = get_channel_handles()

Setup
-----
Set one environment variable on your VPS:

    export DASHBOARD_API_URL=https://your-app.replit.app

Then verify the connection before deploying:

    python channels.py https://your-app.replit.app
"""

import json
import logging
import os
import sys
import urllib.error
import urllib.request
from typing import Optional

logger = logging.getLogger(__name__)

_ENV_API_URL = os.environ.get("DASHBOARD_API_URL", "").rstrip("/")


def get_channel_handles(
    api_url: Optional[str] = None,
    timeout: int = 10,
    fallback_handles: Optional[list] = None,
) -> list:
    """Return the list of YouTube @handles to scrape, fetched from the dashboard API.

    On any failure (network error, bad status, missing env var) the function
    logs a warning and returns `fallback_handles` (or [] if not provided).
    It never raises — the scraper will always get a list back.

    Args:
        api_url: Base URL of the dashboard, e.g. "https://your-app.replit.app".
                 Falls back to the DASHBOARD_API_URL environment variable.
        timeout: HTTP request timeout in seconds. Default 10.
        fallback_handles: Returned when the API is unreachable, so the scraper
                          can continue with a safe default rather than crashing.

    Returns:
        List of YouTube handle strings, e.g. ["@lexfridman", "@aiDotEngineer"].
    """
    safe_fallback = list(fallback_handles) if fallback_handles is not None else []
    base_url = (api_url or _ENV_API_URL).rstrip("/")

    if not base_url:
        logger.warning(
            "DASHBOARD_API_URL is not set — using %d fallback handle(s). "
            "Set it to your deployed Replit dashboard URL to enable dynamic "
            "channel management (e.g. export DASHBOARD_API_URL=https://your-app.replit.app).",
            len(safe_fallback),
        )
        return safe_fallback

    endpoint = f"{base_url}/api/channels"
    req = urllib.request.Request(
        endpoint,
        headers={
            "Accept": "application/json",
            "User-Agent": "vps-scraper-channels/1.0",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            channels = json.loads(resp.read().decode("utf-8"))

        if not isinstance(channels, list):
            raise ValueError(f"Expected JSON array, got {type(channels).__name__}")

        handles = [
            ch["youtubeHandle"]
            for ch in channels
            if isinstance(ch, dict) and ch.get("youtubeHandle")
        ]
        logger.info(
            "channel_source=api url=%s count=%d handles=%s",
            endpoint,
            len(handles),
            handles,
        )
        return handles

    except Exception as exc:
        logger.warning(
            "channel_source=fallback url=%s error=%r fallback_count=%d",
            endpoint,
            str(exc),
            len(safe_fallback),
        )
        return safe_fallback


def get_channels_full(
    api_url: Optional[str] = None,
    timeout: int = 10,
) -> list:
    """Return full channel records (id, displayName, youtubeHandle, scraperName, createdAt).

    Useful when your scraper needs the scraperName mapping — the exact string
    the scraper uses internally for each channel. Returns [] on any error.
    """
    base_url = (api_url or _ENV_API_URL).rstrip("/")
    if not base_url:
        logger.warning("DASHBOARD_API_URL not set — returning empty channel list.")
        return []

    endpoint = f"{base_url}/api/channels"
    req = urllib.request.Request(
        endpoint,
        headers={"Accept": "application/json", "User-Agent": "vps-scraper-channels/1.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            channels = json.loads(resp.read().decode("utf-8"))
        logger.info("Fetched %d channel record(s) from %s", len(channels), endpoint)
        return channels if isinstance(channels, list) else []
    except Exception as exc:
        logger.warning("Failed to fetch channels from %s: %r", endpoint, str(exc))
        return []


# ---------------------------------------------------------------------------
# Smoke-test / connection check:  python channels.py [https://your-app.replit.app]
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    url = sys.argv[1] if len(sys.argv) > 1 else _ENV_API_URL

    if not url:
        print("Usage:  python channels.py https://your-app.replit.app")
        print("  or:   DASHBOARD_API_URL=https://your-app.replit.app python channels.py")
        sys.exit(1)

    print(f"Connecting to {url}/api/channels …")
    handles = get_channel_handles(api_url=url)

    if handles:
        print(f"✓  {len(handles)} tracked channel(s):")
        for h in handles:
            print(f"   {h}")
    else:
        print("✓  Connected — no channels tracked yet.")
        print("   Add channels via the TRACKED_CHANNELS section of the dashboard UI.")
