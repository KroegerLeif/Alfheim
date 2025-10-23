package org.example.backend.service.mapper;

import org.example.backend.controller.dto.create.CreateItemDTO;
import org.example.backend.controller.dto.ItemTableReturnDTO;
import org.example.backend.domain.item.Item;
import org.example.backend.service.mapper.item.CategoryMapper;
import org.springframework.stereotype.Service;

@Service
public class ItemMapper {

    private final CategoryMapper categoryMapper;

    public ItemMapper(CategoryMapper categoryMapper) {
        this.categoryMapper = categoryMapper;
    }

    public Item mapToItem(CreateItemDTO createItemDTO){
        return new Item(
                null,
                createItemDTO.name(),
                categoryMapper.mapToCategory(createItemDTO.category()),
                createItemDTO.energyLabel()
        );
    }

    public ItemTableReturnDTO mapToItemTableReturn(Item item){
        return new ItemTableReturnDTO(
                item.id(),
                item.name(),
                item.energyLabel(),
                item.category().name()
        );
    }
}
