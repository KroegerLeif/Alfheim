package org.example.backend.service.mapper;

import org.example.backend.controller.dto.create.CreateHomeDTO;
import org.example.backend.controller.dto.response.HomeListReturnDTO;
import org.example.backend.controller.dto.response.HomeTableReturnDTO;
import org.example.backend.domain.home.Home;
import org.example.backend.domain.user.Role;
import org.example.backend.service.UserService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class HomeMapper {

    private final UserService userService;

    public HomeMapper(UserService userService) {
        this.userService = userService;
    }

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
                                    getAdminName(home.members()),
                                    getNumberOfTask(),
                                    getNumberOfItems(),
                                    getMemberNames(home.members()));
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

    private String getAdminName(Map<String, Role> members) {
        for (Map.Entry<String, Role> entry : members.entrySet()) {
            if (entry.getValue() == Role.ADMIN) {
                return userService.getUserById(entry.getKey()).name();
            }
        }
        return null; // Or throw an exception if an admin is always expected
    }

    private List<String> getMemberNames(Map<String, Role> members){
        List<String> memberNames = new ArrayList<>();
        members.forEach( (k,v) ->
                memberNames.add(userService.getUserById(k).name()));
        return memberNames;
    }
}
