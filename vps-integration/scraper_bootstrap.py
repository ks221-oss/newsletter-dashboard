"""
scraper_bootstrap.py — production startup code for the VPS scraper.

Replace your existing hardcoded CHANNELS list with the block below.
This is a drop-in replacement: CHANNELS remains a plain list[str] so
nothing else in your scraper needs to change.

Migration steps
---------------
1. Copy channels.py and scraper_bootstrap.py into your VPS project.
2. Set the env var:
       export DASHBOARD_API_URL=https://your-app.replit.app
3. Run the smoke-test once to confirm connectivity:
       python channels.py
4. Replace the hardcoded CHANNELS definition in your scraper with
   the import below.

The fallback_handles list keeps your existing channels as a safety net:
if the dashboard API is temporarily unreachable, the scraper continues
with the known-good list rather than aborting the daily run.
"""

import logging

from channels import get_channel_handles

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Replace this block in your scraper
# ---------------------------------------------------------------------------

# Before:
# CHANNELS = [
#     "@aiDotEngineer",
#     "@DwarkeshPatel",
#     "@20VC",
#     "@allin",
# ]

# After:
CHANNELS = get_channel_handles(
    fallback_handles=[
        "@aiDotEngineer",
        "@DwarkeshPatel",
        "@20VC",
        "@allin",
    ]
)

logger.info(
    "scraper_startup channel_count=%d channels=%s",
    len(CHANNELS),
    CHANNELS,
)

# CHANNELS is a plain list[str] — use it exactly as before.
# Example:
#
#   for handle in CHANNELS:
#       videos = fetch_recent_videos(handle)
#       transcripts = transcribe_videos(videos)
#       ...
