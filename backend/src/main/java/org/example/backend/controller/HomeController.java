package org.example.backend.controller;

import org.example.backend.controller.dto.create.CreateHomeDTO;
import org.example.backend.controller.dto.response.HomeTableReturnDTO;
import org.example.backend.service.HomeService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/home")
public class HomeController {

    private final HomeService homeService;

    public HomeController(HomeService homeService) {
        this.homeService = homeService;
    }

    @GetMapping("")
    public List<HomeTableReturnDTO> getAllHomes() {
        return homeService.getAllHomes();
    }

    @PostMapping("/create")
    public ResponseEntity<HomeTableReturnDTO> createHome(@RequestBody CreateHomeDTO createHomeDTO) {
        HomeTableReturnDTO createdHome = homeService.createNewHome(createHomeDTO);

        return new ResponseEntity<>(createdHome, HttpStatus.CREATED);

    }
}
