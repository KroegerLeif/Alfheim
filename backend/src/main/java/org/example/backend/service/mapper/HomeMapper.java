package org.example.backend.service.mapper;

import org.example.backend.controller.dto.CreateHomeDTO;
import org.example.backend.controller.dto.HomeTableReturnDTO;
import org.example.backend.domain.home.Home;
import org.example.backend.domain.item.Item;
import org.example.backend.domain.task.TaskSeries;
import org.example.backend.domain.user.Role;
import org.example.backend.domain.user.User;

import java.util.ArrayList;
import java.util.HashMap;

public class HomeMapper {

    public Home mapToHome(CreateHomeDTO createHomeDTO){
        return new Home("",
                        createHomeDTO.name(),
                        createHomeDTO.address(),
                        new ArrayList<Item>(),
                        new ArrayList<TaskSeries>(),
                        new HashMap<User, Role>());
    }

    public HomeTableReturnDTO mapToHomeTableReturn(Home home){
        return new HomeTableReturnDTO(home.name(),
                                    home.address(),
                                    "admin",
                                    home.taskSeries().size(),
                                    home.items().size(),
                                    home.members().keySet().stream().map(User -> User.name()).toList());
    }

}
