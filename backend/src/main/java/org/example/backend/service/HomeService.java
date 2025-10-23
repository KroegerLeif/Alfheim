package org.example.backend.service;

import org.example.backend.controller.dto.create.CreateHomeDTO;
import org.example.backend.controller.dto.response.HomeTableReturnDTO;
import org.example.backend.domain.home.Home;
import org.example.backend.repro.HomeRepro;

import org.example.backend.service.mapper.HomeMapper;
import org.example.backend.service.security.IdService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class HomeService {

    private final HomeRepro homeRepro;
    private final HomeMapper homeMapper;
    private final IdService idService;


    public HomeService(HomeRepro homeRepro, HomeMapper homeMapper, IdService idService) {
        this.homeRepro = homeRepro;
        this.homeMapper = homeMapper;
        this.idService = idService;
    }

    public List<HomeTableReturnDTO> getAllHomes() {
        return homeRepro.findAll().stream()
                .map(homeMapper::mapToHomeTableReturn).toList();

    }

    public HomeTableReturnDTO createNewHome(CreateHomeDTO createHomeDTO) {
        Home home = homeMapper.mapToHome(createHomeDTO).withId(idService.createNewId());
        return homeMapper.mapToHomeTableReturn(homeRepro.save(home));
    }
}
