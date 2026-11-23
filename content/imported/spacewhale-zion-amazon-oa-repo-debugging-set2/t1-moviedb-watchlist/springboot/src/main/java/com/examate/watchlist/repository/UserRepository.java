package com.examate.watchlist.repository;

import com.examate.watchlist.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {
}
