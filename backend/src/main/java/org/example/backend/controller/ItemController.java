package org.example.backend.controller;

import org.example.backend.controller.dto.CreateItemDTO;
import org.example.backend.controller.dto.ItemTableReturnDTO;
import org.example.backend.service.ItemService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

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

    @PostMapping("/create")
    @ResponseStatus(HttpStatus.CREATED)
    public ItemTableReturnDTO createNewItem(@RequestBody CreateItemDTO createItemDTO){
        return itemService.createNewItem(createItemDTO);
    }


}
