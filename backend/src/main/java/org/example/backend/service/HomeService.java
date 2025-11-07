package org.example.backend.service;

import org.example.backend.controller.dto.create.CreateHomeDTO;
import org.example.backend.controller.dto.edit.EditHomeDTO;
import org.example.backend.controller.dto.response.HomeListReturnDTO;
import org.example.backend.controller.dto.response.HomeTableReturnDTO;
import org.example.backend.domain.home.Home;
import org.example.backend.domain.user.Role;
import org.example.backend.repro.HomeRepro;

import org.example.backend.service.mapper.HomeMapper;
import org.example.backend.service.security.IdService;
import org.example.backend.service.security.exception.HomeDoesNotExistException;
import org.example.backend.service.security.exception.UserDoesNotHavePermissionException;
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

    public List<HomeTableReturnDTO> getAllHomes(String userId) {
        return homeRepro.findHomesByMemberId(userId).stream()
                .map(homeMapper::mapToHomeTableReturn).toList();
    }

    public HomeTableReturnDTO createNewHome(String userId, CreateHomeDTO createHomeDTO) {
        Home home = homeMapper.mapToHome(createHomeDTO).withId(idService.createNewId());
        home.members().put(userId, Role.ADMIN);
        return homeMapper.mapToHomeTableReturn(homeRepro.save(home));
    }

    public HomeTableReturnDTO editHome(String userId,String id, EditHomeDTO editHomeDTO) throws HomeDoesNotExistException {
        Home home = homeRepro.findById(id).orElseThrow(() ->(new HomeDoesNotExistException("No Home with this ID found")));
        //Chek if User has permission
        checkForPermission(home,userId);

        //Changes Values if Change is provided by User
        if(editHomeDTO.name() != null){
            home = home.withName(editHomeDTO.name());
        }

        if(editHomeDTO.address() != null){
            home = home.withAddress(editHomeDTO.address());
        }

        //Saves Home
        homeRepro.save(home);

        return homeMapper.mapToHomeTableReturn(home);

    }

    public void deleteHome(String userId,String id) {
        //TODO What happens to connect Task
        Home home = homeRepro.findById(id).orElseThrow(() ->(new HomeDoesNotExistException("No Home with this ID found")));
        //Chek if User has permission
        checkForPermission(home,userId);
        homeRepro.deleteById(id);
    }

    public List<HomeListReturnDTO> getHomeNames(String userId) {
        return homeRepro.findHomesByMemberId(userId).stream()
                .map(homeMapper::mapToHomeListReturn)
                .toList();
    }


    public List<String> findHomeConnectedToUser(String userId) {
        return homeRepro.findHomesByMemberId(userId).stream().map(Home::id).toList();
    }

    private void checkForPermission(Home home, String userId){
        if(!home.members().containsKey(userId)){
            throw new UserDoesNotHavePermissionException("User Does Not Have Permission");
        }
    }
}
