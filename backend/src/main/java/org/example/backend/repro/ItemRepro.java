package org.example.backend.repro;

import org.example.backend.domain.item.Item;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ItemRepro extends MongoRepository<Item, String> {
}
