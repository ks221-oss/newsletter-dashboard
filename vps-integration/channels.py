"""
channels.py — fetch tracked YouTube channels from the dashboard API.

Drop this file into your VPS Flask project, then replace your hardcoded
channel list with a call to get_channel_handles().

Setup
-----
1. Deploy your Replit dashboard app to get a public URL
   (e.g. https://your-app.replit.app)
2. Set the env var on your VPS:
       export DASHBOARD_API_URL=https://your-app.replit.app
3. In your scraper code, replace:
       CHANNELS = ["@aiDotEngineer", "@allin", ...]
   with:
       from channels import get_channel_handles
       CHANNELS = get_channel_handles()

The dashboard API (GET /api/channels) returns the channels you've added
via the TRACKED_CHANNELS section of the dashboard UI. Each channel has a
youtubeHandle like "@lexfridman" — exactly the string this function returns.

If DASHBOARD_API_URL is not set, the function logs a warning and returns []
so the scraper degrades gracefully rather than crashing.
"""

import json
import logging
import os
import urllib.error
import urllib.request
from typing import Optional

logger = logging.getLogger(__name__)

_DEFAULT_API_URL = os.environ.get("DASHBOARD_API_URL", "").rstrip("/")


def get_channel_handles(
    api_url: Optional[str] = None,
    timeout: int = 10,
    fallback_handles: Optional[list[str]] = None,
) -> list[str]:
    """Return the list of YouTube handles to scrape, fetched from the dashboard API.

    Args:
        api_url: Base URL of the dashboard (e.g. "https://your-app.replit.app").
                 Defaults to the DASHBOARD_API_URL environment variable.
        timeout: HTTP request timeout in seconds. Default 10.
        fallback_handles: If provided, returned when the API is unreachable instead
                          of raising. Useful as a safety net during initial setup:
                              handles = get_channel_handles(
                                  fallback_handles=["@aiDotEngineer", "@allin"]
                              )

    Returns:
        List of YouTube handle strings, e.g. ["@lexfridman", "@aiDotEngineer"].
        Empty list if DASHBOARD_API_URL is not set.

    Raises:
        RuntimeError: If the API call fails and no fallback_handles were provided.
    """
    base_url = (api_url or _DEFAULT_API_URL).rstrip("/")

    if not base_url:
        logger.warning(
            "DASHBOARD_API_URL is not set — returning %s. "
            "Set it to your deployed dashboard URL to enable dynamic channel management.",
            "fallback handles" if fallback_handles is not None else "empty list",
        )
        return list(fallback_handles) if fallback_handles is not None else []

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
            if resp.status != 200:
                raise urllib.error.HTTPError(
                    endpoint, resp.status, f"Unexpected status {resp.status}", {}, None
                )
            channels = json.loads(resp.read().decode("utf-8"))

        if not isinstance(channels, list):
            raise ValueError(f"Expected a JSON array, got {type(channels).__name__}")

        handles = [
            ch["youtubeHandle"]
            for ch in channels
            if isinstance(ch, dict) and ch.get("youtubeHandle")
        ]
        logger.info("Fetched %d tracked channel(s) from %s", len(handles), endpoint)
        return handles

    except Exception as exc:
        if fallback_handles is not None:
            logger.error(
                "Failed to fetch channels from %s (%s) — using %d fallback handle(s).",
                endpoint,
                exc,
                len(fallback_handles),
            )
            return list(fallback_handles)

        raise RuntimeError(
            f"Could not fetch tracked channels from {endpoint}: {exc}"
        ) from exc


def get_channels_with_scraper_names(
    api_url: Optional[str] = None,
    timeout: int = 10,
) -> list[dict]:
    """Return full channel records including scraperName mappings.

    Useful when your scraper identifies channels by a different name than
    the YouTube handle. The 'scraperName' field (if set) is the exact string
    your scraper reports as the channel name — used to match against telemetry.

    Returns list of dicts with keys: id, displayName, youtubeHandle, scraperName, createdAt.
    """
    base_url = (api_url or _DEFAULT_API_URL).rstrip("/")
    if not base_url:
        logger.warning("DASHBOARD_API_URL is not set — returning empty channel list.")
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
        raise RuntimeError(
            f"Could not fetch tracked channels from {endpoint}: {exc}"
        ) from exc


# ---------------------------------------------------------------------------
# Quick smoke-test: python channels.py
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    url = sys.argv[1] if len(sys.argv) > 1 else _DEFAULT_API_URL

    if not url:
        print("Usage: python channels.py https://your-app.replit.app")
        print("  or set DASHBOARD_API_URL and run: python channels.py")
        sys.exit(1)

    handles = get_channel_handles(api_url=url)
    if handles:
        print(f"Tracked channels ({len(handles)}):")
        for h in handles:
            print(f"  {h}")
    else:
        print("No channels tracked yet. Add some via the dashboard UI.")
