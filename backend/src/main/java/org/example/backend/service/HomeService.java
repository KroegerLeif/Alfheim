package org.example.backend.service;

import org.example.backend.controller.dto.HomeTableReturnDTO;
import org.example.backend.repro.HomeRepro;

import org.example.backend.service.mapper.HomeMapper;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class HomeService {

    private final HomeRepro homeRepro;
    private final HomeMapper homeMapper;

    public HomeService(HomeRepro homeRepro, HomeMapper homeMapper) {
        this.homeRepro = homeRepro;
        this.homeMapper = homeMapper;
    }

    public List<HomeTableReturnDTO> getAllHomes() {
        return homeRepro.findAll().stream()
                .map(homeMapper::mapToHomeTableReturn).toList();

    }
}
