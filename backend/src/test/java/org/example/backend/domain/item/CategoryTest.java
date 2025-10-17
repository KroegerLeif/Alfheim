package org.example.backend.domain.item;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CategoryTest {

    @Test
    void testCategoryRecord() {
        Category category = new Category("1", "Electronics");

        assertEquals("1", category.id());
        assertEquals("Electronics", category.name());
    }
}
