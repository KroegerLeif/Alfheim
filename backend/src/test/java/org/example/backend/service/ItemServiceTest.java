package org.example.backend.service;

import org.example.backend.controller.dto.create.CreateItemDTO;
import org.example.backend.controller.dto.edit.EditItemDTO;
import org.example.backend.controller.dto.response.HomeListReturnDTO;
import org.example.backend.controller.dto.response.ItemTableReturnDTO;
import org.example.backend.domain.item.Category;
import org.example.backend.domain.item.EnergyLabel;
import org.example.backend.domain.item.Item;
import org.example.backend.repro.ItemRepro;
import org.example.backend.service.mapper.ItemMapper;
import org.example.backend.service.security.IdService;
import org.example.backend.service.security.exception.ItemDoesNotExistException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ItemServiceTest {

    @Mock
    private ItemRepro mockRepo;
    @Mock
    private ItemMapper itemMapper;

    @Mock
    private IdService idService;

    @Mock
    private HomeService homeService;

    @Mock
    private TaskService taskService;

    private ItemService itemService;

    @BeforeEach
    void setUp() {
        itemService = new ItemService(mockRepo, itemMapper, idService, homeService, taskService);
    }


    @Test
    void getAll_shouldReturnEmptyList_whenNoItemsExist() {
        // GIVEN
        List<String> homeIds = List.of("home123");
        when(homeService.findHomeConnectedToUser("user")).thenReturn(homeIds);
        when(mockRepo.findAllByHomeId("home123")).thenReturn(new ArrayList<>());

        // WHEN
        var actual = itemService.getAll("user");

        // THEN
        verify(homeService).findHomeConnectedToUser("user");
        verify(mockRepo).findAllByHomeId("home123");
        assertEquals(0, actual.size());
    }

    @Test
    void getAll_shouldReturnList_whenItemsExist() {
        // GIVEN
        List<String> homeIds = List.of("home123");
        List<Item> itemsFromHome = List.of(
                new Item("1", "Test", null, null, "home123"),
                new Item("2", "Test2", null, null, "home123")
        );
        when(homeService.findHomeConnectedToUser("user")).thenReturn(homeIds);
        when(mockRepo.findAllByHomeId("home123")).thenReturn(itemsFromHome);

        // WHEN
        var actual = itemService.getAll("user");

        // THEN
        verify(homeService).findHomeConnectedToUser("user");
        verify(mockRepo).findAllByHomeId("home123");
        assertEquals(2, actual.size());
    }

    @Test
    void getAllNames_shouldReturnListOfNames_whenItemsExist() {
        // GIVEN
        List<String> homeIds = List.of("home123");
        List<Item> itemsFromHome = List.of(
                new Item("1", "Test", null, null, "home123"),
                new Item("2", "Test2", null, null, "home123")
        );
        when(homeService.findHomeConnectedToUser("user")).thenReturn(homeIds);
        when(mockRepo.findAllByHomeId("home123")).thenReturn(itemsFromHome);

        // WHEN
        var actual = itemService.getItemNames("user");

        // THEN
        verify(homeService).findHomeConnectedToUser("user");
        verify(mockRepo).findAllByHomeId("home123");
        assertEquals(2, actual.size());
    }

    @Test
    void createNewItem_shouldReturnANewItem_whenCalled(){
        //GIVEN
        CreateItemDTO createItemDTO = new CreateItemDTO("Test", EnergyLabel.E, "TestCategory","home123");
        Category category_beforeId = new Category(null, "TestCategory");
        Item item_beforeId = new Item(null, "Test", category_beforeId, EnergyLabel.E,"home123");

        Category category_afterId = new Category("1", "TestCategory");
        Item item_afterId = new Item("1", "Test", category_afterId, EnergyLabel.E,"home123");

        ItemTableReturnDTO expectedTableReturn = new ItemTableReturnDTO("1", "Test", EnergyLabel.E, "TestCategory",new ArrayList<>(),new HomeListReturnDTO("home123","test"));
        List<String> homeIds = new ArrayList<>();
        homeIds.add("home123");
        when(homeService.findHomeConnectedToUser("user")).thenReturn(homeIds);
        when(idService.createNewId()).thenReturn("1");
        when(itemMapper.mapToItem(createItemDTO)).thenReturn(item_beforeId);
        when(mockRepo.findFirstByCategory_Name("TestCategory")).thenReturn(Optional.empty());
        when(mockRepo.save(item_afterId)).thenReturn(item_afterId);
        when(itemMapper.mapToItemTableReturn(item_afterId, Collections.emptyList())).thenReturn(expectedTableReturn);

        //WHEN
        var actual = itemService.createNewItem("user",createItemDTO);
        //THEN
        assertEquals(expectedTableReturn, actual);
        Mockito.verify(mockRepo).save(item_afterId);

    }

    @Test
    void editItem_shouldThrowItemDoesNotExistException_whenItemDoesNotExist(){
        // GIVEN
        String id = "1";
        when(mockRepo.findById(id)).thenReturn(Optional.empty());

        // WHEN & THEN
        ItemDoesNotExistException exception = assertThrows(ItemDoesNotExistException.class,
                () -> itemService.editItem("user", id, new EditItemDTO("Test", "TestCategory", EnergyLabel.E, "")));
        assertEquals("No Item with this ID", exception.getMessage());
    }

    @Test
    void editItem_shouldReturnUpdatedItem_whenCalled() {
        //GIVEN
        String id = "1";
        EditItemDTO editItemDTO = new EditItemDTO("Kühlschrank", "Küche", EnergyLabel.E,"");
        Item savedItem = new Item(id, "Test", null, null,"home123");
        ItemTableReturnDTO expectedTableReturn = new ItemTableReturnDTO(id,
                                                                    "Kühlschrank",
                                                                    EnergyLabel.E,
                                                                    "Küche",
                                                                    new ArrayList<>(),
                                                                    new HomeListReturnDTO("home123",
                                                                                        "test")
        );

        List<String> homeIds = new ArrayList<>();
        homeIds.add("home123");
        when(homeService.findHomeConnectedToUser("user")).thenReturn(homeIds);
        when(mockRepo.findById(id)).thenReturn(Optional.of(savedItem));
        when(itemMapper.mapToItemTableReturn(any(Item.class), anyList())).thenReturn(expectedTableReturn);
        //WHEN
        var actual = itemService.editItem("user",id, editItemDTO);
        //THEN
        verify(mockRepo).findById(id);
        assertEquals(expectedTableReturn, actual);

    }

    @Test
    void getItemByIdShouldReturnItemWhenItemExist(){
        //GIVEN
        String id = "1";
        Item item = new Item(id, "Test", null, null,"home123");
        when(mockRepo.findById(id)).thenReturn(Optional.of(item));
        when(homeService.findHomeConnectedToUser("user")).thenReturn(List.of("home123"));
        //WHEN
        var actual = itemService.getItemById("user",id);
        //THEN
        verify(mockRepo).findById(id);
        assertEquals(item, actual);
    }

    @Test
    void getItemById_shouldThrowItemDoesNotExistException_whenItemDoesNotExist(){
        // GIVEN
        String id = "1";
        when(mockRepo.findById(id)).thenReturn(Optional.empty());

        // WHEN & THEN
        ItemDoesNotExistException exception = assertThrows(ItemDoesNotExistException.class,
                () -> itemService.getItemById("user", id));
        assertEquals("No Item with this ID", exception.getMessage());
    }

    @Test
    void deleteItem_shouldDeleteItem_whenCalled(){
        //GIVEN
        String id = "1";
        when(mockRepo.findById(id)).thenReturn(Optional.of(generateItem()));
        when(homeService.findHomeConnectedToUser("user")).thenReturn(List.of("home123"));
        doNothing().when(mockRepo).deleteById(id);
        //WHEN
        itemService.deleteItem("user",id);
        //THEN
        verify(mockRepo).deleteById(id);

    }

    @Test
    void deleteItem_shouldThrowItemDoesNotExistException_whenCalled(){
        // GIVEN
        String id = "1";
        when(mockRepo.findById(id)).thenReturn(Optional.empty());

        // WHEN & THEN
        ItemDoesNotExistException exception = assertThrows(ItemDoesNotExistException.class,
                () -> itemService.deleteItem("user", id));
        assertEquals("No Item with this ID", exception.getMessage());


    }

    private Item generateItem(){
        return new Item("1", "Test", null, null,"home123");
    }
}