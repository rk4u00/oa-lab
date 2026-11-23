"""Text helpers used by the search layers."""


def normalize(text):
    """Lower-case and trim. Everything compared during search goes through here."""
    return (text or "").strip().lower()


def split_stars(stars):
    return [s.strip() for s in (stars or "").split(",") if s.strip()]
