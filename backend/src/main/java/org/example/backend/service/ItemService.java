package org.example.backend.service;

import org.example.backend.controller.dto.create.CreateItemDTO;
import org.example.backend.controller.dto.edit.EditItemDTO;
import org.example.backend.controller.dto.response.ItemTableReturnDTO;
import org.example.backend.domain.item.Category;
import org.example.backend.domain.item.EnergyLabel;
import org.example.backend.domain.item.Item;
import org.example.backend.repro.ItemRepro;
import org.example.backend.service.mapper.ItemMapper;
import org.example.backend.service.security.IdService;
import org.example.backend.service.security.exception.ItemDoesNotExistException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class ItemService {

    private final ItemRepro itemRepro;

    private final ItemMapper itemMapper;

    private final IdService idService;
    private final HomeService homeService;


    public ItemService(ItemRepro itemRepro, ItemMapper itemMapper, IdService idService, HomeService homeService) {
        this.itemRepro = itemRepro;
        this.itemMapper = itemMapper;
        this.idService = idService;
        this.homeService = homeService;
    }

    public List<ItemTableReturnDTO> getAll(){
        String currentUserId = SecurityContextHolder.getContext().getAuthentication().getName();
        // Annahme: homeService hat eine Methode, um alle Home-IDs eines Users zu bekommen
        // List<String> userHomeIds = homeService.getHomeIdsForUser(currentUserId);

        // Temporäre Lösung, bis homeService.getHomeIdsForUser existiert:
        // Wir filtern nach dem Speichern. Eine richtige Implementierung würde
        // itemRepro.findByHomeIdIn(userHomeIds) verwenden.
        return itemRepro.findAll().stream() // Dies sollte später optimiert werden
                // .filter(item -> userHomeIds.contains(item.homeId()))
                .map(itemMapper::mapToItemTableReturn)
                .collect(Collectors.toList());
    }

    public Item getItemById(String id) {
        return itemRepro.findById(id).orElseThrow(() -> new ItemDoesNotExistException("No Item with this ID"));
    }

    public ItemTableReturnDTO createNewItem(CreateItemDTO createItemDTO){
        // TODO: Berechtigungsprüfung: Darf der aktuelle User Items in dieser `homeId` erstellen?
        // String currentUserId = SecurityContextHolder.getContext().getAuthentication().getName();
        // if (!homeService.isUserMemberOfHome(createItemDTO.homeId(), currentUserId)) { ... }

        Item item = creatUniqueIds(itemMapper.mapToItem(createItemDTO));
        itemRepro.save(item);
        ItemTableReturnDTO returnDTO = itemMapper.mapToItemTableReturn(item);
        return returnDTO;
    }

    public void deleteItem(String id) {
        // TODO: Berechtigungsprüfung: Darf der User dieses Item löschen?
        // Item item = getItemById(id);
        // if (!homeService.isUserMemberOfHome(item.homeId(), currentUserId)) { ... }
        itemRepro.deleteById(id);
    }

    private Item creatUniqueIds(Item item){
        //Creation of new IDs
        String item_id = idService.createNewId();

        Category itemCategory = getUniqueCategroy(item.category());

        return new Item(
                item_id,
                item.name(),
                itemCategory,
                item.energyLabel(),
                item.homeId()
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

    public ItemTableReturnDTO editItem(String id, EditItemDTO editItemDTO) {
        // TODO: Berechtigungsprüfung vor dem Laden und Bearbeiten
        Item item = itemRepro.findById(id).orElseThrow(() -> new ItemDoesNotExistException("No Item with this ID"));

        //Checks every Value and changes them accordingly
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
            // TODO: Berechtigungsprüfung für das neue Zuhause
            item = item.withHomeId(editItemDTO.homeId());
        }
        itemRepro.save(item);
        return itemMapper.mapToItemTableReturn(item);
    }

    private Item changeItemName(Item item, String newName){
        return item.withName(newName);
    }

    private Item changeEnergyLabel(Item item, EnergyLabel newEnergyLabel){
        return item.withEnergyLabel(newEnergyLabel);
    }

    private Item changeItemCategory(Item item, String categoryName) {
        Category itemCategory = getUniqueCategroy(new Category(null, categoryName));
        return item.withCategory(itemCategory);
    }

}
