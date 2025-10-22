package org.example.backend.service;

import org.example.backend.controller.dto.ItemTableReturnDTO;
import org.example.backend.repro.ItemRepro;
import org.example.backend.service.mapper.ItemMapper;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ItemService {

    private final ItemRepro itemRepro;

    private final ItemMapper itemMapper;

    public ItemService(ItemRepro itemRepro, ItemMapper itemMapper) {
        this.itemRepro = itemRepro;
        this.itemMapper = itemMapper;
    }

    public List<ItemTableReturnDTO> getAll(){
        return itemRepro.findAll().stream()
                .map(itemMapper::mapToItemTableReturn)
                .toList();
    }
}
