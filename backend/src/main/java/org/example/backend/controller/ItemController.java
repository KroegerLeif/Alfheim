package org.example.backend.controller;

import org.example.backend.controller.dto.create.CreateItemDTO;
import org.example.backend.controller.dto.edit.EditItemDTO;
import org.example.backend.controller.dto.response.ItemListReturn;
import org.example.backend.controller.dto.response.ItemTableReturnDTO;
import org.example.backend.service.ItemService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
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
    public List<ItemTableReturnDTO> getAllItems(Principal principal){
        return itemService.getAll(principal.getName());
    }

    @GetMapping("/getNames")
    @ResponseStatus(HttpStatus.OK)
    public List<ItemListReturn> getItemNames(Principal principal) {
        return itemService.getItemNames(principal.getName());
    }

    @PostMapping("/create")
    @ResponseStatus(HttpStatus.CREATED)
    public ItemTableReturnDTO createNewItem(Principal principal,
                                            @RequestBody CreateItemDTO createItemDTO){
        return itemService.createNewItem(principal.getName(),createItemDTO);
    }

    @PatchMapping("/{id}/edit")
    @ResponseStatus(HttpStatus.OK)
    public ItemTableReturnDTO editItem(Principal principal,
                                       @PathVariable String id,
                                       @RequestBody EditItemDTO editItemDTO){
        return itemService.editItem(principal.getName(), id, editItemDTO);
    }

    @DeleteMapping("/{id}/delete")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void deleteAllItems(Principal principal,
                               @PathVariable String id){
        itemService.deleteItem(principal.getName(), id);
    }

}
