"""
example_integration.py — shows how to wire channels.py into a typical
VPS scraper that currently uses a hardcoded channel list.

This is a reference only. Copy the relevant parts into your actual scraper.
"""

import os
from channels import get_channel_handles

# ── Before ──────────────────────────────────────────────────────────────────
# CHANNELS = [
#     "@aiDotEngineer",
#     "@DwarkeshPatel",
#     "@20VC",
#     "@allin",
# ]

# ── After ───────────────────────────────────────────────────────────────────
#
# Pass your old hardcoded list as fallback_handles so the scraper continues
# to work even if the dashboard API is temporarily unreachable.
#
CHANNELS = get_channel_handles(
    fallback_handles=[
        "@aiDotEngineer",
        "@DwarkeshPatel",
        "@20VC",
        "@allin",
    ]
)

# CHANNELS is now a plain list[str] — use it exactly as before:
#   for handle in CHANNELS:
#       videos = fetch_recent_videos(handle)
#       ...

print(f"Scraping {len(CHANNELS)} channel(s): {CHANNELS}")
