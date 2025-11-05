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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;

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

    private ItemService itemService;

    @BeforeEach
    void setUp() {
        itemService = new ItemService(mockRepo, itemMapper, idService, homeService);

        // Simulate a logged-in user for all tests
        Authentication authentication = Mockito.mock(Authentication.class);
        SecurityContext securityContext = Mockito.mock(SecurityContext.class);
        when(securityContext.getAuthentication()).thenReturn(authentication);
        when(authentication.getName()).thenReturn("user-123");
        SecurityContextHolder.setContext(securityContext);
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
        // GIVEN
        List<Item> response = List.of(
                new Item("1", "Test", new Category("c1", "cat1"), EnergyLabel.A, "home-1"),
                new Item("2", "Test2", new Category("c2", "cat2"), EnergyLabel.B, "home-2")
        );
        when(mockRepo.findAll()).thenReturn(response);
        when(itemMapper.mapToItemTableReturn(any(Item.class))).thenReturn(new ItemTableReturnDTO(null, null, null, null, null));

        // WHEN
        var actual = itemService.getAll();

        // THEN
        Mockito.verify(mockRepo).findAll();
        assertEquals(2, actual.size());
    }

    @Test
    void createNewItem_shouldReturnANewItem_whenCalled(){
        // GIVEN
        CreateItemDTO createItemDTO = new CreateItemDTO("New Lamp", EnergyLabel.C, "Lighting", "home-123");

        Item item_beforeId = new Item(null, "New Lamp", new Category(null, "Lighting"), EnergyLabel.C, "home-123");
        when(itemMapper.mapToItem(createItemDTO)).thenReturn(item_beforeId);

        when(idService.createNewId()).thenReturn("item-456", "cat-789");
        when(mockRepo.findFirstByCategory_Name("Lighting")).thenReturn(Optional.empty());

        ArgumentCaptor<Item> itemCaptor = ArgumentCaptor.forClass(Item.class);
        when(mockRepo.save(itemCaptor.capture())).thenAnswer(invocation -> invocation.getArgument(0));

        ItemTableReturnDTO expectedDTO = new ItemTableReturnDTO("item-456", "New Lamp", EnergyLabel.C, "Lighting", "home-123");
        when(itemMapper.mapToItemTableReturn(any(Item.class))).thenReturn(expectedDTO);

        // WHEN
        var actual = itemService.createNewItem(createItemDTO);

        // THEN
        assertEquals(expectedDTO, actual);

        Item savedItem = itemCaptor.getValue();
        assertEquals("item-456", savedItem.id());
        assertEquals("home-123", savedItem.homeId());
        assertEquals("cat-789", savedItem.category().id());
    }

    @Test
    void editItem_shouldThrowItemDoesNotExistException_whenItemDoesNotExist(){
        // GIVEN
        String id = "1";
        when(mockRepo.findById(id)).thenReturn(Optional.empty());

        // WHEN & THEN
        assertThrows(ItemDoesNotExistException.class, () -> {
            itemService.editItem(id, new EditItemDTO("Test", "TestCategory", EnergyLabel.E, ""));
        });
    }

    @Test
    void editItem_shouldReturnUpdatedItem_whenCalled() {
        // GIVEN
        String id = "1";
        EditItemDTO editItemDTO = new EditItemDTO("Kühlschrank", "Küche", EnergyLabel.E, "home-456");
        Item savedItem = new Item(id, "Test", new Category("c1", "OldCat"), EnergyLabel.A, "home-123");

        ItemTableReturnDTO expectedDTO = new ItemTableReturnDTO(id, "Kühlschrank", EnergyLabel.E, "Küche", "home-456");

        when(mockRepo.findById(id)).thenReturn(Optional.of(savedItem));
        when(mockRepo.findFirstByCategory_Name("Küche")).thenReturn(Optional.empty());
        when(idService.createNewId()).thenReturn("new-cat-id");

        ArgumentCaptor<Item> itemCaptor = ArgumentCaptor.forClass(Item.class);
        when(mockRepo.save(itemCaptor.capture())).thenAnswer(invocation -> invocation.getArgument(0));

        when(itemMapper.mapToItemTableReturn(any(Item.class))).thenReturn(expectedDTO);

        // WHEN
        var actual = itemService.editItem(id, editItemDTO);

        // THEN
        assertEquals(expectedDTO, actual);

        Item updatedItem = itemCaptor.getValue();
        assertEquals("Kühlschrank", updatedItem.name());
        assertEquals(EnergyLabel.E, updatedItem.energyLabel());
        assertEquals("Küche", updatedItem.category().name());
        assertEquals("home-456", updatedItem.homeId());
    }

    @Test
    void getItemByIdShouldReturnItemWhenItemExist(){
        // GIVEN
        String id = "1";
        Item item = new Item(id, "Test", new Category("c1", "cat1"), EnergyLabel.A, "home-1");
        when(mockRepo.findById(id)).thenReturn(Optional.of(item));

        // WHEN
        var actual = itemService.getItemById(id);

        // THEN
        assertEquals(item, actual);
    }

    @Test
    void getItemById_shouldThrowItemDoesNotExistException_whenItemDoesNotExist(){
        // GIVEN
        String id = "1";
        when(mockRepo.findById(id)).thenReturn(Optional.empty());

        // WHEN & THEN
        assertThrows(ItemDoesNotExistException.class, () -> itemService.getItemById(id));
    }

    @Test
    void deleteItem_shouldDeleteItem_whenCalled(){
        // GIVEN
        String id = "1";
        doNothing().when(mockRepo).deleteById(id);

        // WHEN
        itemService.deleteItem(id);

        // THEN
        Mockito.verify(mockRepo).deleteById(id);
    }
}