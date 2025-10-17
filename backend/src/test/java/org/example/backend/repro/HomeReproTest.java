package org.example.backend.repro;

import org.example.backend.domain.home.Address;
import org.example.backend.domain.home.Home;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@DataMongoTest
class HomeReproTest {

    @Autowired
    private HomeRepro homeRepro;

    @Test
    void getHomeById_shouldReturnHome() {
        // Given
        Address address = new Address("1", "street", "postCode", "city", "country");
        Home home = new Home("1", "My Home", address, Collections.emptyList(), Collections.emptyList(), Collections.emptyMap());
        homeRepro.save(home);

        // When
        Home foundHome = homeRepro.getHomeById("1");

        // Then
        assertNotNull(foundHome);
        assertEquals("My Home", foundHome.name());
    }
}
