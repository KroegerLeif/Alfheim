package org.example.backend.repro;

import org.example.backend.domain.home.Home;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface HomeRepro extends MongoRepository<Home, String> {

    Home getHomeById(String id);
    
}
