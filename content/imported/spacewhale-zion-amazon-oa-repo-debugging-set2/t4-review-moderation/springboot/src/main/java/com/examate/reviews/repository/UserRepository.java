package com.examate.reviews.repository;

import com.examate.reviews.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {
}
