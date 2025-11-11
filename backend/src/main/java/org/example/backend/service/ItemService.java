package org.example.backend.service;

import org.example.backend.controller.dto.create.CreateItemDTO;
import org.example.backend.controller.dto.edit.EditItemDTO;
import org.example.backend.controller.dto.response.ItemListReturn;
import org.example.backend.controller.dto.response.ItemTableReturnDTO;
import org.example.backend.controller.dto.response.TaskListReturn;
import org.example.backend.domain.item.Category;
import org.example.backend.domain.item.EnergyLabel;
import org.example.backend.domain.item.Item;
import org.example.backend.repro.ItemRepro;
import org.example.backend.service.mapper.ItemMapper;
import org.example.backend.service.security.IdService;
import org.example.backend.service.security.exception.ItemDoesNotExistException;
import org.example.backend.service.security.exception.UserDoesNotHavePermissionException;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class ItemService {

    private final ItemRepro itemRepro;
    private final ItemMapper itemMapper;
    private final IdService idService;
    private final HomeService homeService;
    private final TaskService taskService; // Added TaskService dependency

    public ItemService(ItemRepro itemRepro, ItemMapper itemMapper, IdService idService, HomeService homeService, TaskService taskService) {
        this.itemRepro = itemRepro;
        this.itemMapper = itemMapper;
        this.idService = idService;
        this.homeService = homeService;
        this.taskService = taskService;
    }

    public List<ItemTableReturnDTO> getAll(String userId){
        return getAllItems(userId).stream()
                .map(item -> {
                    List<TaskListReturn> tasks = taskService.getTasksByItemId(item.id());
                    return itemMapper.mapToItemTableReturn(item, tasks);
                })
                .toList();
    }

    public List<ItemListReturn> getItemNames(String userId) {
        return getAllItems(userId).stream().
                map(itemMapper::mapToItemListReturn)
                .toList();
    }

    public Item getItemById(String userId, String id) {
        Item item = itemRepro.findById(id).orElseThrow(()
                -> new ItemDoesNotExistException("No Item with this ID"));
        checksIfUserIsAssignedToItem(item, userId);
        return item;
    }

    public ItemTableReturnDTO createNewItem(CreateItemDTO createItemDTO){
        Item item = creatUniqueIds(itemMapper.mapToItem(createItemDTO));
        itemRepro.save(item);
        // Assuming createNewItem also needs to return ItemTableReturnDTO with tasks,
        // but since it's a new item, it won't have tasks yet.
        // If it needs to display tasks, you might need to fetch them here or adjust the DTO.
        return itemMapper.mapToItemTableReturn(item, Collections.emptyList());
    }

    public void deleteItem(String userId, String id) {
        Item item = itemRepro.findById(id).orElseThrow(() -> new ItemDoesNotExistException("No Item with this ID"));
        checksIfUserIsAssignedToItem(item, userId);
        itemRepro.deleteById(id);
    }

    public ItemTableReturnDTO editItem(String userId, String id, EditItemDTO editItemDTO) {
        Item item = itemRepro.findById(id).orElseThrow(() -> new ItemDoesNotExistException("No Item with this ID"));

        //Checks every Value and changes them accordingly
        checksIfUserIsAssignedToItem(item, userId);

        if(editItemDTO.name() != null){
            item = changeItemName(item, editItemDTO.name());
        }
        if (editItemDTO.energyLabel() != null) {
            item = changeEnergyLabel(item, editItemDTO.energyLabel());
        }
        if (editItemDTO.category() != null) {
            item = changeItemCategory(item, editItemDTO.category());
        }
        if (editItemDTO.homeId() != null) {
            item = changeHome(item, editItemDTO.homeId());
        }
        itemRepro.save(item);
        List<TaskListReturn> tasks = taskService.getTasksByItemId(item.id());
        return itemMapper.mapToItemTableReturn(item, tasks);
    }

    private Item creatUniqueIds(Item item){
        //Creation of new IDs
        String item_id = idService.createNewId();

        Category itemCategory = getUniqueCategory(item.category());

        return new Item(
                item_id,
                item.name(),
                itemCategory,
                item.energyLabel(),
                item.homeId()
        );
    }

    private Category getUniqueCategory(Category category){
        //Checks If Category already Exists
        Optional<Item> itemWithCategory = itemRepro.findFirstByCategory_Name(category.name());

        //Create New Item
        return itemWithCategory
                .map(Item::category) // If an item with this category exists, use its category (with ID)
                .orElseGet(() -> category.withId(idService.createNewId())); // Otherwise, create a new category with a new ID
    }

    private Item changeItemName(Item item, String newName){
        return item.withName(newName);
    }

    private Item changeEnergyLabel(Item item, EnergyLabel newEnergyLabel){
        return item.withEnergyLabel(newEnergyLabel);
    }

    private Item changeItemCategory(Item item, String categoryName) {
        Category itemCategory = getUniqueCategory(new Category(null, categoryName));
        return item.withCategory(itemCategory);
    }
    private Item changeHome(Item item, String homeID){
        return item.withHomeId(homeID);
    }

    private void checksIfUserIsAssignedToItem(Item item, String userId) {
        String homeId = item.homeId();
        if (!homeService.findHomeConnectedToUser(userId).contains(homeId)){
            throw new UserDoesNotHavePermissionException("User does not have premision");
        }
    }
    private Set<Item> getAllItems(String userId){
        List<String> homeIds = homeService.findHomeConnectedToUser(userId);
        List<Item> allItems = new ArrayList<>();
        for(String homeId: homeIds) {
            allItems.addAll(itemRepro.findAllByHomeId(homeId));
        }
        //Removes Duplicates
        return new HashSet<>(allItems);
    }

}
