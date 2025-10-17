package org.example.backend.repro;

import org.example.backend.domain.user.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserRepro extends MongoRepository<User, String> {
}
