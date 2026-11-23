package com.examate.loans.repository;

import com.examate.loans.model.Loan;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/** All the methods you need already exist here. No bugs in this file. */
public interface LoanRepository extends JpaRepository<Loan, Long> {
    List<Loan> findByBorrowerIdOrderByIdAsc(Long borrowerId);

    List<Loan> findByLenderIdOrderByIdAsc(Long lenderId);
}
