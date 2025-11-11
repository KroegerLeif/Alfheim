package org.example.backend.service.mapper;

import org.example.backend.controller.dto.create.CreateItemDTO;
import org.example.backend.controller.dto.response.HomeListReturnDTO;
import org.example.backend.controller.dto.response.ItemListReturn;
import org.example.backend.controller.dto.response.ItemTableReturnDTO;
import org.example.backend.controller.dto.response.TaskListReturn;
import org.example.backend.domain.item.Item;
import org.example.backend.service.HomeService;
import org.example.backend.service.mapper.item.CategoryMapper;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ItemMapper {

    private final CategoryMapper categoryMapper;
    private final HomeService homeService;

    public ItemMapper(CategoryMapper categoryMapper, HomeService homeService) {
        this.categoryMapper = categoryMapper;
        this.homeService = homeService;
    }

    public Item mapToItem(CreateItemDTO createItemDTO){
        return new Item(
                null,
                createItemDTO.name(),
                categoryMapper.mapToCategory(createItemDTO.category()),
                createItemDTO.energyLabel(),
                createItemDTO.homeId()
        );
    }

    public ItemTableReturnDTO mapToItemTableReturn(Item item, List<TaskListReturn> tasks){
        return new ItemTableReturnDTO(
                item.id(),
                item.name(),
                item.energyLabel(),
                item.category().name(),
                tasks,
                new HomeListReturnDTO(
                    item.homeId(),
                    getHomeName(item.homeId())
                )
        );
    }

    public ItemListReturn mapToItemListReturn(Item item){
        return new ItemListReturn(
                item.id(),
                item.name()
        );
    }

    private String getHomeName(String id){
        return homeService.getHomeNameById(id);
    }
}
