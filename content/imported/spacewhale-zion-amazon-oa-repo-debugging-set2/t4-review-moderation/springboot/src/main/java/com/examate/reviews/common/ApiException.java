package com.examate.reviews.common;

import java.util.Map;
import org.springframework.http.HttpStatus;

/** Thrown by services/controllers; turned into a JSON error by GlobalExceptionHandler. No bugs here. */
public class ApiException extends RuntimeException {
    private final HttpStatus status;
    private final Map<String, Object> extra;

    public ApiException(HttpStatus status, String message) {
        this(status, message, Map.of());
    }

    public ApiException(HttpStatus status, String message, Map<String, Object> extra) {
        super(message);
        this.status = status;
        this.extra = extra;
    }

    public HttpStatus getStatus() { return status; }
    public Map<String, Object> getExtra() { return extra; }
}
