package org.example.backend.service;

import org.example.backend.domain.home.Home;
import org.example.backend.domain.item.Item;
import org.example.backend.repro.HomeRepro;
import org.example.backend.repro.ItemRepro;
import org.example.backend.service.mapper.HomeMapper;
import org.example.backend.service.mapper.ItemMapper;
import org.example.backend.service.security.IdService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.Mockito;

import java.util.ArrayList;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

class ItemServiceTest {

    @Mock
    private final ItemRepro mockRepo = Mockito.mock(ItemRepro.class);
    @Mock
    private final ItemMapper itemMapper = Mockito.mock(ItemMapper.class);

    private final ItemService itemService = new ItemService(mockRepo, itemMapper);

    @AfterEach
    void tearDown() {
        mockRepo.deleteAll();
    }

    @Test
    void getAll_shouldReturnEmptyList_whenNoItemsExist() {
        //WHEN
        ArrayList<Item> response = new ArrayList<Item>();
        when(mockRepo.findAll()).thenReturn(response);
        //THEN
        var actual = itemService.getAll();
        Mockito.verify(mockRepo).findAll();
        assertEquals(0, actual.size());
    }

    @Test
    void getAll_shouldReturnList_whenItemsExist() {
        //WHEN
        ArrayList<Item> response = new ArrayList<Item>();
        response.add(new Item("1", "Test", null, null));
        response.add(new Item("2", "Test2", null, null));
        when(mockRepo.findAll()).thenReturn(response);
        //THEN
        var actual = itemService.getAll();
        Mockito.verify(mockRepo).findAll();
        assertEquals(2, actual.size());
    }
}