"""
test_channels.py — integration tests for channels.py.

Run with:  python test_channels.py [https://your-app.replit.app]

Tests both the happy path (live API) and failure-mode fallback behaviour.
Pass the dashboard URL as an argument to run the live API test, or omit it
to run only the offline/fallback tests.
"""

import logging
import sys
import unittest
from unittest.mock import MagicMock, patch

# Silence logging during tests
logging.disable(logging.CRITICAL)

import channels as ch_module
from channels import get_channel_handles, get_channels_full


class TestGetChannelHandlesFallback(unittest.TestCase):
    """Offline tests — no real HTTP calls."""

    def test_no_env_var_returns_empty(self):
        with patch.object(ch_module, "_ENV_API_URL", ""):
            result = get_channel_handles(api_url=None)
        self.assertEqual(result, [])

    def test_no_env_var_returns_fallback(self):
        fallback = ["@foo", "@bar"]
        with patch.object(ch_module, "_ENV_API_URL", ""):
            result = get_channel_handles(api_url=None, fallback_handles=fallback)
        self.assertEqual(result, fallback)

    def test_fallback_on_network_error(self):
        fallback = ["@safe"]
        with patch("urllib.request.urlopen", side_effect=OSError("Connection refused")):
            result = get_channel_handles(api_url="http://bad-host", fallback_handles=fallback)
        self.assertEqual(result, fallback)

    def test_fallback_on_non_200_response(self):
        fallback = ["@safe"]
        mock_resp = MagicMock()
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)
        mock_resp.status = 500
        mock_resp.read.return_value = b'{"error": "internal server error"}'
        with patch("urllib.request.urlopen", side_effect=Exception("HTTP 500")):
            result = get_channel_handles(api_url="http://host", fallback_handles=fallback)
        self.assertEqual(result, fallback)

    def test_empty_list_response(self):
        import json
        mock_resp = MagicMock()
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)
        mock_resp.read.return_value = json.dumps([]).encode()
        with patch("urllib.request.urlopen", return_value=mock_resp):
            result = get_channel_handles(api_url="http://host")
        self.assertEqual(result, [])

    def test_parses_youtube_handles(self):
        import json
        channels = [
            {"id": 1, "displayName": "Lex", "youtubeHandle": "@lexfridman", "scraperName": None, "createdAt": "2026-01-01T00:00:00Z"},
            {"id": 2, "displayName": "AI Eng", "youtubeHandle": "@aiDotEngineer", "scraperName": "AI Engineer", "createdAt": "2026-01-02T00:00:00Z"},
        ]
        mock_resp = MagicMock()
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)
        mock_resp.read.return_value = json.dumps(channels).encode()
        with patch("urllib.request.urlopen", return_value=mock_resp):
            result = get_channel_handles(api_url="http://host")
        self.assertEqual(result, ["@lexfridman", "@aiDotEngineer"])

    def test_never_raises(self):
        """get_channel_handles must not raise under any error condition."""
        with patch("urllib.request.urlopen", side_effect=RuntimeError("boom")):
            try:
                result = get_channel_handles(api_url="http://host")
                self.assertIsInstance(result, list)
            except Exception as e:
                self.fail(f"get_channel_handles raised unexpectedly: {e}")


class TestLiveApi(unittest.TestCase):
    """Live integration test — requires DASHBOARD_API_URL or a CLI argument."""

    api_url: str = ""

    def test_live_get_channel_handles_returns_list(self):
        if not self.api_url:
            self.skipTest("No live API URL provided")
        result = get_channel_handles(api_url=self.api_url)
        self.assertIsInstance(result, list)
        for h in result:
            self.assertIsInstance(h, str)
            self.assertTrue(h.startswith("@"), f"Handle should start with @: {h!r}")
        print(f"\n  Live API returned {len(result)} handle(s): {result}")

    def test_live_get_channels_full_returns_records(self):
        if not self.api_url:
            self.skipTest("No live API URL provided")
        records = get_channels_full(api_url=self.api_url)
        self.assertIsInstance(records, list)
        for r in records:
            self.assertIn("youtubeHandle", r)
            self.assertIn("displayName", r)


if __name__ == "__main__":
    # Allow: python test_channels.py https://your-app.replit.app
    live_url = ""
    args = [a for a in sys.argv[1:] if a.startswith("http")]
    if args:
        live_url = args[0]
        sys.argv = [sys.argv[0]]  # remove URL from argv so unittest doesn't choke

    TestLiveApi.api_url = live_url

    logging.disable(logging.NOTSET)
    unittest.main(verbosity=2)
