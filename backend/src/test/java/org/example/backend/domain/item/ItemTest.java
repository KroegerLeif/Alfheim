package org.example.backend.domain.item;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ItemTest {

    @Test
    void testItemRecord() {
        Category category = new Category("1", "Electronics");
        Item item = new Item("1", "Laptop", category, EnergyLabel.A, "home-123");

        assertEquals("1", item.id());
        assertEquals("Laptop", item.name());
        assertEquals("home-123", item.homeId());
        assertEquals(category, item.category());
        assertEquals(EnergyLabel.A, item.energyLabel());
    }
}
