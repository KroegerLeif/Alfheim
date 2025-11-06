package org.example.backend.repro;

import org.example.backend.domain.home.Home;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HomeRepro extends MongoRepository<Home, String> {

    Home getHomeById(String id);
    @Query("{ 'members.?0': { $exists: true } }")
    List<Home> findHomesByMemberId(String userId);
    
}
