package org.example.backend.repro;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;

@DataMongoTest
class ItemReproTest {

    @Autowired
    private ItemRepro itemRepro;

}