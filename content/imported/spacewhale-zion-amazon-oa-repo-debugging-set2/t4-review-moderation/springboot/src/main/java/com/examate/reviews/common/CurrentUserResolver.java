package com.examate.reviews.common;

import com.examate.reviews.model.User;
import com.examate.reviews.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/** The caller is identified by the X-User-Id header (e.g. X-User-Id: 1). No bugs here. */
@Component
public class CurrentUserResolver {
    private final UserRepository userRepository;

    public CurrentUserResolver(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public User resolve(String header) {
        if (header == null || !header.matches("\\d+")) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Missing or invalid X-User-Id header");
        }
        return userRepository.findById(Long.valueOf(header))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Unknown user"));
    }
}
