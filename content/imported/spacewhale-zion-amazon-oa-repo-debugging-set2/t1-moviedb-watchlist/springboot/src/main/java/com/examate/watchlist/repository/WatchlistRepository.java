package com.examate.watchlist.repository;

import com.examate.watchlist.model.WatchlistEntry;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** All the methods you need already exist here. No bugs in this file. */
public interface WatchlistRepository extends JpaRepository<WatchlistEntry, Long> {
    boolean existsByUserIdAndMovieId(Long userId, Long movieId);

    Optional<WatchlistEntry> findByUserIdAndMovieId(Long userId, Long movieId);

    List<WatchlistEntry> findByUserIdOrderByIdAsc(Long userId);
}
