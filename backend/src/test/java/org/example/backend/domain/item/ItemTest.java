package org.example.backend.domain.item;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ItemTest {

    @Test
    void testItemRecord() {
        Category category = new Category("1", "Electronics");
        Item item = new Item("1", "Laptop", category, EnergyLabel.A);

        assertEquals("1", item.id());
        assertEquals("Laptop", item.name());
        assertEquals(category, item.category());
        assertEquals(EnergyLabel.A, item.energyLabel());
    }
}
