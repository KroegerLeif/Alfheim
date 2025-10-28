package org.example.backend.controller;

import org.example.backend.controller.dto.create.CreateItemDTO;
import org.example.backend.controller.dto.response.ItemTableReturnDTO;
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

    @PatchMapping("/{id}/edit")
    @ResponseStatus(HttpStatus.OK)
    public ItemTableReturnDTO editItem(@PathVariable String id,
                                       @RequestBody CreateItemDTO createItemDTO){
        return itemService.editItem(id,createItemDTO);
    }

    @DeleteMapping("/{id}/delete")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void deleteAllItems(@PathVariable String id){
        itemService.deleteItem(id);
    }

}
