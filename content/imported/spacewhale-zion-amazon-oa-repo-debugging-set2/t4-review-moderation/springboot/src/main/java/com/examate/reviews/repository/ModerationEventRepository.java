package com.examate.reviews.repository;

import com.examate.reviews.model.ModerationEvent;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ModerationEventRepository extends JpaRepository<ModerationEvent, Long> {
    List<ModerationEvent> findByUserId(Long userId);
}
