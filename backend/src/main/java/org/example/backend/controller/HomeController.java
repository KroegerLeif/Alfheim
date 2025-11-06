package org.example.backend.controller;

import org.example.backend.controller.dto.create.CreateHomeDTO;
import org.example.backend.controller.dto.edit.EditHomeDTO;
import org.example.backend.controller.dto.response.HomeListReturnDTO;
import org.example.backend.controller.dto.response.HomeTableReturnDTO;
import org.example.backend.service.HomeService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/home")
public class HomeController {

    private final HomeService homeService;

    public HomeController(HomeService homeService) {
        this.homeService = homeService;
    }

    @GetMapping("")
    public List<HomeTableReturnDTO> getAllHomes(Principal principal) {
        return homeService.getAllHomes(principal.getName());
    }

    @GetMapping("/getNames")
    @ResponseStatus(HttpStatus.OK)
    public List<HomeListReturnDTO> getHomeNames(Principal principal) {
        return homeService.getHomeNames(principal.getName());
    }

    @PostMapping("/create")
    public ResponseEntity<HomeTableReturnDTO> createHome(Principal principal, @RequestBody CreateHomeDTO createHomeDTO) {
        HomeTableReturnDTO createdHome = homeService.createNewHome(principal.getName(), createHomeDTO);

        return new ResponseEntity<>(createdHome, HttpStatus.CREATED);

    }

    @PatchMapping("/{id}/edit")
    @ResponseStatus(HttpStatus.OK)
    public HomeTableReturnDTO editHome(Principal principal, @PathVariable String id, @RequestBody EditHomeDTO editHomeDTO) {
        return homeService.editHome(principal.getName(),id, editHomeDTO);
    }

    @DeleteMapping("/{id}/delete")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void deleteHome(Principal principal, @PathVariable String id) {
        homeService.deleteHome(principal.getName(),id);
    }

}
