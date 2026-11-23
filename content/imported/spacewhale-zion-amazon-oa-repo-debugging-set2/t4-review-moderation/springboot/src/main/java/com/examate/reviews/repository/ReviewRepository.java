package com.examate.reviews.repository;

import com.examate.reviews.model.Review;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReviewRepository extends JpaRepository<Review, Long> {
    Optional<Review> findByIdAndUserId(Long id, Long userId);

    List<Review> findByUserId(Long userId);
}
