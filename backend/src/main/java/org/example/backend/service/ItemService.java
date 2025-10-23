package org.example.backend.service;

import org.example.backend.controller.dto.create.CreateItemDTO;
import org.example.backend.controller.dto.response.ItemTableReturnDTO;
import org.example.backend.domain.item.Category;
import org.example.backend.domain.item.Item;
import org.example.backend.repro.ItemRepro;
import org.example.backend.service.mapper.ItemMapper;
import org.example.backend.service.security.IdService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class ItemService {

    private final ItemRepro itemRepro;

    private final ItemMapper itemMapper;

    private final IdService idService;


    public ItemService(ItemRepro itemRepro, ItemMapper itemMapper, IdService idService) {
        this.itemRepro = itemRepro;
        this.itemMapper = itemMapper;
        this.idService = idService;
    }

    public List<ItemTableReturnDTO> getAll(){
        return itemRepro.findAll().stream()
                .map(itemMapper::mapToItemTableReturn)
                .toList();
    }

    public ItemTableReturnDTO createNewItem(CreateItemDTO createItemDTO){
        Item item = creatUniqueIds(itemMapper.mapToItem(createItemDTO));
        itemRepro.save(item);
        return itemMapper.mapToItemTableReturn(item);
    }

    private Item creatUniqueIds(Item item){
        //Creation of new IDs
        String item_id = idService.createNewId();

        Category itemCategory = getUniqueCategroy(item.category());

        return new Item(
                item_id,
                item.name(),
                itemCategory,
                item.energyLabel()
        );
    }

    private Category getUniqueCategroy(Category category){
        //Checks If Category already Exists
        Optional<Item> itemWithCategory = itemRepro.findFirstByCategory_Name(category.name());

        //Create New Item
        return itemWithCategory
                .map(Item::category) // If an item with this category exists, use its category (with ID)
                .orElseGet(() -> category.withId(idService.createNewId())); // Otherwise, create a new category with a new ID
    }
}
