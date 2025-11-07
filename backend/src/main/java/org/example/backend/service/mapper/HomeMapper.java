package org.example.backend.service.mapper;

import org.example.backend.controller.dto.create.CreateHomeDTO;
import org.example.backend.controller.dto.response.HomeListReturnDTO;
import org.example.backend.controller.dto.response.HomeTableReturnDTO;
import org.example.backend.domain.home.Home;
import org.springframework.stereotype.Service;

import java.util.HashMap;

@Service
public class HomeMapper {

    public Home mapToHome(CreateHomeDTO createHomeDTO){
        return new Home("",
                        createHomeDTO.name(),
                        createHomeDTO.address(),
                        new HashMap<>());
    }

    public HomeTableReturnDTO mapToHomeTableReturn(Home home){
        return new HomeTableReturnDTO(home.id(),
                                    home.name(),
                                    home.address(),
                                    "admin",
                                    getNumberOfTask(),
                                    getNumberOfItems(),
                                    home.members().keySet().stream().toList());//TODO get Names of all Members
    }

    public HomeListReturnDTO mapToHomeListReturn(Home home) {
        return new HomeListReturnDTO(home.id(),
                                    home.name());
    }

    private int getNumberOfTask(){
        //TODO getNumberOfTask
        return 0;
    }

    private int getNumberOfItems(){
        //TODO getNumberOfItems
        return 0;
    }
}
