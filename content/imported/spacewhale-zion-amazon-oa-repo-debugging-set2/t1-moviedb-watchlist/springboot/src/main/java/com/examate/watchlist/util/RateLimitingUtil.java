package com.examate.watchlist.util;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;
import org.springframework.stereotype.Component;

/**
 * Per-user rate limiting for watchlist write operations (add + remove combined):
 * at most MAX_OPERATIONS successful operations in any rolling WINDOW_MILLIS window.
 */
@Component
public class RateLimitingUtil {
    public static final int MAX_OPERATIONS = 5;
    public static final long WINDOW_MILLIS = 60_000L;

    private final Map<String, List<Long>> userOperations = new ConcurrentHashMap<>();
    private LongSupplier clock = System::currentTimeMillis;

    public void setClock(LongSupplier clock) {
        this.clock = clock;
    }

    private List<Long> recentOperations(String userId) {
        long now = clock.getAsLong();
        List<Long> recent = new ArrayList<>(userOperations.getOrDefault(userId, new ArrayList<>()));
        userOperations.put(userId, recent);
        return recent;
    }

    public boolean isRateLimited(String userId) {
        return recentOperations(userId).size() > MAX_OPERATIONS;
    }

    public void registerOperation(String userId) {
        recentOperations(userId).add(clock.getAsLong());
    }

    public void reset() {
        userOperations.clear();
    }
}
