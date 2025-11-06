package org.example.backend.service;

import org.example.backend.controller.dto.create.CreateHomeDTO;
import org.example.backend.controller.dto.edit.EditHomeDTO;
import org.example.backend.controller.dto.response.HomeTableReturnDTO;
import org.example.backend.domain.home.Address;
import org.example.backend.domain.home.Home;
import org.example.backend.domain.task.*;
import org.example.backend.repro.HomeRepro;
import org.example.backend.service.mapper.HomeMapper;
import org.example.backend.service.security.IdService;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.Mockito;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

class HomeServiceTest {

    @Mock
    private final HomeRepro mockRepo = Mockito.mock(HomeRepro.class);
    @Mock
    private final HomeMapper homeMapper = Mockito.mock(HomeMapper.class);
    @Mock
    private final IdService idService = Mockito.mock(IdService.class);


    HomeService homeService = new HomeService(mockRepo,homeMapper,idService);

    @Test
    void getAllHomes() {
        //WHEN
        ArrayList<Home> response = new ArrayList<>();
        when(mockRepo.findAll()).thenReturn(response);
        //THEN
        homeService.getAllHomes();
        Mockito.verify(mockRepo).findAll();
    }

    @Test
    void getHomeNames_shouldReturnAllHomes_whenCalled(){
        //GIVEN
        Home home = new Home("1", "Test", new Address("1", "street", "postCode", "city", "country"),new HashMap<>());
        ArrayList<Home> response = new ArrayList<>();
        response.add(home);

        when(mockRepo.findAll()).thenReturn(response);
        //WHEN
        homeService.getHomeNames();
        //THEN
        Mockito.verify(mockRepo).findAll();
    }

    @Test
    void createNewHome_shouldReturnHomeTableReturnDTO_whenHomeIsCreated() {
        //GIVEN
        Address address = new Address("1", "street", "postCode", "city", "country");
        Home home = new Home("1", "home", address, new HashMap<>());
        CreateHomeDTO createHomeDTO = new CreateHomeDTO("Home",address);
        HomeTableReturnDTO homeTableReturnDTO = new HomeTableReturnDTO("1","Test",address,"admin",0,0,new ArrayList<>());
        //Mocking
        when(homeMapper.mapToHome(createHomeDTO)).thenReturn(home);
        when(idService.createNewId()).thenReturn("1");
        when(homeMapper.mapToHomeTableReturn(home)).thenReturn(homeTableReturnDTO);
        when(mockRepo.save(home)).thenReturn(home);

        //WHEN
        var actual = homeService.createNewHome(createHomeDTO);

        //THEN
        assertEquals(actual,homeTableReturnDTO);

    }

    @Test
    void editHome_shouldReturnAnUpdatedHome_whenHomeIsEdited() {
        //GIVEN
        Address address = new Address("1", "street", "postCode", "city", "country");
        Address address2 = new Address("2", "street2", "postCode", "Town", "country");
        Home home = new Home("1", "home", address, new HashMap<>());
        String id = "1";
        EditHomeDTO editHomeDTO = getEditHomeDTO();
        HomeTableReturnDTO expected = new HomeTableReturnDTO("1","Test",address2,"admin",0,0,new ArrayList<>());

        //MOCKING
        when(mockRepo.findById(id)).thenReturn(java.util.Optional.of(home));
        when(mockRepo.save(any(Home.class))).thenReturn(home);
        when(homeMapper.mapToHomeTableReturn(any(Home.class))).thenReturn(expected);

        //
        var actual = homeService.editHome(id,editHomeDTO);

        //THEN
        assertEquals(expected,actual);

    }

    @Test
    void deleteHome_shouldDeleteHome_whenCalled() {
        //GIVEN
        String id = "1";
        mockRepo.save(
                new Home(id,
                        "Test",
                        new Address("1",
                                "street",
                                "postCode",
                                "city",
                                "country"),
                        new HashMap<>()));
        //WHEN
        homeService.deleteHome(id);
        //THEN
        Mockito.verify(mockRepo).deleteById(id);

    }

    @Test
    void findHomeConnectedToUser_shouldReturnAListOfHomesConnectedToTheUser(){
        //GIVEN
        String userId = "1";
        List<Home> homes = new ArrayList<>();
        homes.add(new Home("1",
                "Test",
                null,
                new HashMap<>()));
        homes.add(new Home("2",
                "Test2",
                null,
                new HashMap<>()));
        when(mockRepo.findHomesByMemberId(userId)).thenReturn(homes);
        //WHEN
        var actual = homeService.findHomeConnectedToUser(userId);
        //THEN
        assertEquals(2,actual.size());
        assertEquals("1",actual.get(0));
        assertEquals("2",actual.get(1));

    }


    private static EditHomeDTO getEditHomeDTO() {
        Address updatedAddress = new Address("12", "new street", "new postCode", "new city", "new country");

        List<String> associatedUsers = new ArrayList<>();
        associatedUsers.add("1");

        return new EditHomeDTO("Updated Home", updatedAddress,associatedUsers);
    }

}