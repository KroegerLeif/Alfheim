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
                        new HashMap<>());
    }

    public HomeTableReturnDTO mapToHomeTableReturn(Home home){
        return new HomeTableReturnDTO(home.id(),
                                    home.name(),
                                    home.address(),
                                    "admin",
                                    0,//TODO open Task Service ad get all Task assotiadted with this user
                                    0,//TODO open item Service ad get all Item assotiadted with this user
                                    home.members().keySet().stream().toList());//TODO May at thier role as well
    }

    public HomeListReturnDTO mapToHomeListReturn(Home home) {
        return new HomeListReturnDTO(home.id(),
                                    home.name());
    }
}
