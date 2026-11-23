"""Per-user rate limiting for watchlist write operations (add + remove combined)."""
import time

MAX_OPERATIONS = 5      # at most 5 successful operations ...
WINDOW_SECONDS = 60     # ... in any rolling 60-second window


class RateLimitingUtil:
    def __init__(self, clock=time.time):
        self.clock = clock
        self.user_operations = {}  # user_id -> list of timestamps of successful operations

    def _recent_operations(self, user_id):
        now = self.clock()
        recent = self.user_operations.get(user_id, [])
        self.user_operations[user_id] = recent
        return recent

    def is_rate_limited(self, user_id):
        return len(self._recent_operations(user_id)) > MAX_OPERATIONS

    def register_operation(self, user_id):
        self._recent_operations(user_id).append(self.clock())

    def reset(self):
        self.user_operations.clear()


rate_limiter = RateLimitingUtil()
