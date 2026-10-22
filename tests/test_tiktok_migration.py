import sqlite3
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class TikTokSecurityMigrationTests(unittest.TestCase):
    def test_creates_rate_limit_state_and_refresh_lock_tables(self):
        migration = (ROOT / "migrations/0001_tiktok_auth_security.sql").read_text(encoding="utf-8")
        connection = sqlite3.connect(":memory:")
        connection.executescript(migration)

        tables = {
            row[0]
            for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
        }
        self.assertTrue({
            "tiktok_auth_rate_limits",
            "tiktok_oauth_states",
            "tiktok_token_refresh_lock",
        }.issubset(tables))

    def test_oauth_state_hash_is_unique(self):
        migration = (ROOT / "migrations/0001_tiktok_auth_security.sql").read_text(encoding="utf-8")
        connection = sqlite3.connect(":memory:")
        connection.executescript(migration)
        connection.execute(
            "INSERT INTO tiktok_oauth_states (state_hash, redirect_uri, expires_at) VALUES (?, ?, ?)",
            ("state-hash", "https://preview.example/api/tiktok/callback", 1),
        )
        with self.assertRaises(sqlite3.IntegrityError):
            connection.execute(
                "INSERT INTO tiktok_oauth_states (state_hash, redirect_uri, expires_at) VALUES (?, ?, ?)",
                ("state-hash", "https://preview.example/api/tiktok/callback", 1),
            )


if __name__ == "__main__":
    unittest.main()
