package org.example.backend.service;

import org.example.backend.controller.dto.create.CreateHomeDTO;
import org.example.backend.controller.dto.edit.EditHomeDTO;
import org.example.backend.controller.dto.response.HomeTableReturnDTO;
import org.example.backend.domain.home.Address;
import org.example.backend.domain.home.Home;
import org.example.backend.repro.HomeRepro;
import org.example.backend.service.mapper.HomeMapper;
import org.example.backend.service.security.IdService;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.Mockito;

import java.util.ArrayList;
import java.util.HashMap;

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
        ArrayList<Home> response = new ArrayList<Home>();
        when(mockRepo.findAll()).thenReturn(response);
        //THEN
        homeService.getAllHomes();
        Mockito.verify(mockRepo).findAll();
    }

    @Test
    void createNewHome_shouldRetrunHomeTableReturnDTO_whenHomeIsCreated() {
        //GIVEN
        Address address = new Address("1", "street", "postCode", "city", "country");
        Home home = new Home("1", "home", address, new ArrayList<>(), new ArrayList<>(), new HashMap<>());
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
        Home home = new Home("1", "home", address, new ArrayList<>(), new ArrayList<>(), new HashMap<>());
        String id = "1";
        EditHomeDTO editHomeDTO = new EditHomeDTO("Test",address2);
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
}