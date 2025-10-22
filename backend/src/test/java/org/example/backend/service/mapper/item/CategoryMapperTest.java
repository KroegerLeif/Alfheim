package org.example.backend.service.mapper.item;

import org.example.backend.domain.item.Category;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class CategoryMapperTest {

    @Test
    void mapToCategory_shouldReturnACategory_whenCalled() {
        //GIVEN
        String name = "Test";
        Category category = new Category(null, name);

        //WHEN
        var actual = new CategoryMapper().mapToCategory(name);

        //THEN
        assertEquals(category,actual);
    }
}