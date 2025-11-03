package org.example.backend.service.mapper;

import org.example.backend.controller.dto.create.CreateHomeDTO;
import org.example.backend.controller.dto.response.HomeListReturnDTO;
import org.example.backend.controller.dto.response.HomeTableReturnDTO;
import org.example.backend.domain.home.Home;
import org.example.backend.domain.user.User;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;

@Service
public class HomeMapper {

    public Home mapToHome(CreateHomeDTO createHomeDTO){
        return new Home("",
                        createHomeDTO.name(),
                        createHomeDTO.address(),
                        new ArrayList<>(),
                        new ArrayList<>(),
                        new HashMap<>());
    }

    public HomeTableReturnDTO mapToHomeTableReturn(Home home){
        return new HomeTableReturnDTO(home.id(),
                                    home.name(),
                                    home.address(),
                                    "admin",
                                    home.taskSeries().size(),
                                    home.items().size(),
                                    home.members().keySet().stream().map(User::name).toList());
    }

    public HomeListReturnDTO mapToHomeListReturn(Home home) {
        return new HomeListReturnDTO(home.id(),
                                    home.name());
    }
}
