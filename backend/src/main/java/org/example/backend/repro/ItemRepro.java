package org.example.backend.repro;

import org.example.backend.domain.item.Item;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ItemRepro extends MongoRepository<Item, String> {
    Optional<Item> findFirstByCategory_Name(String name);
    List<Item> findAllByHomeId(String homeId);
}
