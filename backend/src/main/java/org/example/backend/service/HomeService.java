package org.example.backend.service;

import org.example.backend.domain.home.Home;
import org.example.backend.repro.HomeRepro;

import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class HomeService {

    private final HomeRepro homeRepro;

    public HomeService(HomeRepro homeRepro) {
        this.homeRepro = homeRepro;
    }

    public List<Home> getAllHomes() {
        return homeRepro.findAll();
    }
}
