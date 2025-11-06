package org.example.backend.repro;

import org.example.backend.domain.home.Home;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HomeRepro extends MongoRepository<Home, String> {

    Home getHomeById(String id);
    List<String> findHomeConnectedToUser(String userId);
    
}
