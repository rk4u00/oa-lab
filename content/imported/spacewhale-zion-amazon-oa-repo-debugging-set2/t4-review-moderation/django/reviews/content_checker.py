"""Existing bad-content checker. This module is correct - do not change it."""
import re

BANNED_WORDS = {"idiot", "stupid", "trash", "scam", "garbage"}


def find_violations(text):
    """Return the banned words found in text: whole words, case-insensitive, unique, sorted."""
    words = re.findall(r"[a-z]+", (text or "").lower())
    return sorted({w for w in words if w in BANNED_WORDS})
