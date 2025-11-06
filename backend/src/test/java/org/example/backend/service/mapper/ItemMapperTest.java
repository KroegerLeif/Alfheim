package org.example.backend.service.mapper;

import org.example.backend.controller.dto.create.CreateItemDTO;
import org.example.backend.controller.dto.response.ItemTableReturnDTO;
import org.example.backend.domain.item.Category;
import org.example.backend.domain.item.EnergyLabel;
import org.example.backend.domain.item.Item;
import org.example.backend.service.mapper.item.CategoryMapper;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

class ItemMapperTest {

    private final CategoryMapper categoryMapper = Mockito.mock(CategoryMapper.class);

    private final ItemMapper itemMapper;

    public ItemMapperTest() {
        this.itemMapper = new ItemMapper(categoryMapper);
    }

    @Test
    void mapToItem_shouldReturnAnItem_whenCalled() {
        //GIVEN
        CreateItemDTO createItemDTO = new CreateItemDTO("Test",
                                                        EnergyLabel.A,
                                                        "TestCategory",
                                                        "home123");

        Category category = new Category(null, "TestCategory");
        when(categoryMapper.mapToCategory(
                    createItemDTO.category())
            ).thenReturn(category);

        Item expected = new Item(null,
                                "Test",
                                category,
                                EnergyLabel.A,
                                "home123"
                                );
        //WHEN
        var actual = itemMapper.mapToItem(createItemDTO);
        //THEN
        assertEquals(expected,actual);
    }

    @Test
    void mapToItemTableReturn_shouldReturnAnItemTableReturn_whenCalled() {
        //GIVEN
        Item item = new Item("1",
                "Test",
                new Category(null, "TestCategory"),
                EnergyLabel.A,
                "home123");

        ItemTableReturnDTO expected = new ItemTableReturnDTO("1",
                "Test",
                EnergyLabel.A,
                "TestCategory",
                "home123");
        //WHEN
        var actual = itemMapper.mapToItemTableReturn(item);
        //THEN
        assertEquals(expected,actual);

    }

}