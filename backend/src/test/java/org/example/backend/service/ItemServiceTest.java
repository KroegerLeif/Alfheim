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
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.Mockito;

import java.util.ArrayList;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;

class ItemServiceTest {

    @Mock
    private final ItemRepro mockRepo = Mockito.mock(ItemRepro.class);
    @Mock
    private final ItemMapper itemMapper = Mockito.mock(ItemMapper.class);

    @Mock
    private final IdService idService = Mockito.mock(IdService.class);

    @Mock
    private final HomeService homeService = Mockito.mock(HomeService.class);

    private final ItemService itemService = new ItemService(mockRepo, itemMapper, idService, homeService);

    @AfterEach
    void tearDown() {
        mockRepo.deleteAll();
    }

    @Test
    void getAll_shouldReturnEmptyList_whenNoItemsExist() {
        //WHEN
        ArrayList<Item> response = new ArrayList<>();
        when(mockRepo.findAll()).thenReturn(response);
        //THEN
        var actual = itemService.getAll();
        Mockito.verify(mockRepo).findAll();
        assertEquals(0, actual.size());
    }

    @Test
    void getAll_shouldReturnList_whenItemsExist() {
        //WHEN
        ArrayList<Item> response = new ArrayList<>();
        response.add(new Item("1", "Test", null, null));
        response.add(new Item("2", "Test2", null, null));
        when(mockRepo.findAll()).thenReturn(response);
        //THEN
        var actual = itemService.getAll();
        Mockito.verify(mockRepo).findAll();
        assertEquals(2, actual.size());
    }

    @Test
    void createNewItem_shouldReturnANewItem_whenCalled(){
        //GIVEN
        CreateItemDTO createItemDTO = new CreateItemDTO("Test", EnergyLabel.E, "TestCategory");
        Category category_beforeId = new Category(null, "TestCategory");
        Item item_beforeId = new Item(null, "Test", category_beforeId, EnergyLabel.E);

        Category category_afterId = new Category("1", "TestCategory");
        Item item_afterId = new Item("1", "Test", category_afterId, EnergyLabel.E);

        ItemTableReturnDTO expectedTableReturn = new ItemTableReturnDTO("1", "Test", EnergyLabel.E, "TestCategory");

        when(idService.createNewId()).thenReturn("1");
        when(itemMapper.mapToItem(createItemDTO)).thenReturn(item_beforeId);
        when(mockRepo.findFirstByCategory_Name("TestCategory")).thenReturn(Optional.empty());
        when(mockRepo.save(item_afterId)).thenReturn(item_afterId);
        when(itemMapper.mapToItemTableReturn(item_afterId)).thenReturn(expectedTableReturn);

        //WHEN
        var actual = itemService.createNewItem(createItemDTO);
        //THEN
        assertEquals(expectedTableReturn, actual);
        Mockito.verify(mockRepo).save(item_afterId);

    }

    @Test
    void editItem_shouldThrowItemDoesNotExistException_whenItemDoesNotExist(){
        try{
            String id = "1";
            when(mockRepo.findById(id)).thenReturn(Optional.empty());
            itemService.editItem(id,new EditItemDTO("Test",  "TestCategory",EnergyLabel.E,""));
        }catch (ItemDoesNotExistException e){
            assertEquals("No Item with this ID",e.getMessage());
        }
    }

    @Test
    void editItem_shouldReturnUpdatedItem_whenCalled() {
        //GIVEN
        String id = "1";
        EditItemDTO editItemDTO = new EditItemDTO("Kühlschrank", "Küche", EnergyLabel.E,"");
        Item savedItem = new Item(id, "Test", null, null);
        mockRepo.save(savedItem);
        ItemTableReturnDTO expectedTableReturn = new ItemTableReturnDTO(id,
                                                                    "Kühlschrank",
                                                                    EnergyLabel.E,
                                                                    "Küche"
        );
        when(mockRepo.findById(id)).thenReturn(Optional.of(savedItem));
        when(itemMapper.mapToItemTableReturn(Mockito.any(Item.class))).thenReturn(expectedTableReturn);
        //WHEN
        var actual = itemService.editItem(id, editItemDTO);
        //THEN
        Mockito.verify(mockRepo).findById(id);
        assertEquals(expectedTableReturn, actual);

    }

    @Test
    void getItemByIdShouldReturnItemWhenItemExist(){
        //GIVEN
        String id = "1";
        Item item = new Item(id, "Test", null, null);
        mockRepo.save(item);
        when(mockRepo.findById(id)).thenReturn(Optional.of(item));
        //WHEN
        var actual = itemService.getItemById(id);
        //THEN
        Mockito.verify(mockRepo).findById(id);
        assertEquals(item, actual);
    }

    @Test
    void getItemById_shouldThrowItemDoesNotExistException_whenItemDoesNotExist(){
        try{
            String id = "1";
            when(mockRepo.findById(id)).thenReturn(Optional.empty());
            itemService.getItemById(id);
            }catch (ItemDoesNotExistException e){
            assertEquals("No Item with this ID",e.getMessage());
        }
    }

    @Test
    void deleteItem_shouldDeleteItem_whenCalled(){
        //GIVEN
        String id = "1";
        mockRepo.save(new Item(id, "Test", null, null));
        doNothing().when(mockRepo).deleteById(id);
        //WHEN
        itemService.deleteItem(id);
        //THEN
        Mockito.verify(mockRepo).deleteById(id);

    }
}