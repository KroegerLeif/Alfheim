package org.example.backend.controller;

import org.example.backend.controller.dto.ItemTableReturnDTO;
import org.example.backend.service.ItemService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/item")
public class ItemController {

    private final ItemService itemService;

    public ItemController(ItemService itemService) {
        this.itemService = itemService;
    }

    @GetMapping("")
    @ResponseStatus(HttpStatus.OK)
    public List<ItemTableReturnDTO> getAllItems(){
        return itemService.getAll();
    }

}
