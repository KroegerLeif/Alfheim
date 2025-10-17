package org.example.backend.domain.home;

import org.junit.jupiter.api.Test;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;

class HomeTest {

    @Test
    void testHomeRecord() {
        Address address = new Address("1", "Musterstraße", "12345", "Musterstadt", "Musterland");
        Home home = new Home("1", "My Home", address, Collections.emptyList(), Collections.emptyList(), Collections.emptyMap());

        assertEquals("1", home.id());
        assertEquals("My Home", home.name());
        assertEquals(address, home.address());
        assertEquals(Collections.emptyList(), home.items());
        assertEquals(Collections.emptyList(), home.taskSeries());
        assertEquals(Collections.emptyMap(), home.members());
    }
}
