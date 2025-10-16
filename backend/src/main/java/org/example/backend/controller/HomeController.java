package org.example.backend.controller;

import org.example.backend.controller.dto.HomeTableReturnDTO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/home")
public class HomeController {

    @GetMapping("")
    public List<HomeTableReturnDTO> getAllHomes() {
        return null;
    }
}
