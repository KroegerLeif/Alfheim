package org.example.backend.domain.user;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class UserTest {

    @Test
    void testUserRecord() {
        User user = new User("1", "Test User");

        assertEquals("1", user.id());
        assertEquals("Test User", user.name());
    }
}
