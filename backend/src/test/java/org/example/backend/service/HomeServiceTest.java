package org.example.backend.service;

import org.example.backend.controller.dto.create.CreateHomeDTO;
import org.example.backend.controller.dto.edit.EditHomeDTO;
import org.example.backend.controller.dto.response.HomeTableReturnDTO;
import org.example.backend.domain.home.Address;
import org.example.backend.domain.home.Home;
import org.example.backend.domain.item.Item;
import org.example.backend.domain.task.*;
import org.example.backend.repro.HomeRepro;
import org.example.backend.service.mapper.HomeMapper;
import org.example.backend.service.security.IdService;
import org.example.backend.service.security.exception.HomeDoesNotExistException;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.Mockito;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
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
    void getHomeNames_shouldReturnAllHomes_whenCalled(){
        //GIVEN
        Home home = new Home("1", "Test", new Address("1", "street", "postCode", "city", "country"), new ArrayList<>(), new ArrayList<>(), new HashMap<>());
        ArrayList<Home> response = new ArrayList<Home>();
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
                        new ArrayList<>(),
                        new ArrayList<>(),
                        new HashMap<>()));
        //WHEN
        homeService.deleteHome(id);
        //THEN
        Mockito.verify(mockRepo).deleteById(id);

    }

    @Test
    void addTaskToHome_shouldAddTaskToHome_whenCalled() {
        //GIVEN
        TaskSeries taskSeries = createTaskSeries();
        String homeId = "1";
        Home home = new Home(homeId, "Test", new Address("1", "street", "postCode", "city", "country"), new ArrayList<>(), new ArrayList<>(), new HashMap<>());

        //MOCKING
        when(mockRepo.findById(homeId)).thenReturn(java.util.Optional.of(home));

        //WHEN
        homeService.addTaskToHome(homeId, taskSeries);
        //THEN
        Mockito.verify(mockRepo).findById(homeId);
        Mockito.verify(mockRepo).save(any(Home.class));
    }

    @Test
    void addTaskToHOme_shouldThrowHomeDoesNotExistException_whenHomeDoesNotExist(){
        // GIVEN
        String id = "Unique1";
        when(mockRepo.findById(id)).thenReturn(java.util.Optional.empty());
        TaskSeries taskSeries = createTaskSeries();

        // WHEN & THEN
        HomeDoesNotExistException exception = assertThrows(HomeDoesNotExistException.class, () -> homeService.addTaskToHome(id, taskSeries));
        assertEquals("Home does not Exist", exception.getMessage());
    }

    @Test
    void getHomeWithConnectedTask_ShouldReturnStringOfHomeID_whenCalled(){
        //GIVEN
        List<String> taskSeriesList = new ArrayList<>();
        taskSeriesList.add("1");
        Home home = new Home("1",
                "Test",
                        new Address("1",
                                 "street",
                                "postCode",
                                "city",
                                "country"),
                new ArrayList<>(),
                taskSeriesList,
                new HashMap<>());
        when(mockRepo.findAll()).thenReturn(List.of(home));
        //WHEN
        String actual = homeService.getHomeWithConnectedTask("1");
        //THEN
        assertEquals("Test",actual);
    }

    @Test
    void getHomeWithConnectedTask_ShouldThrowHomeDoesNotExistException_whenTaskDoesNotExist(){
        //GIVEN
        try{

            List<String> taskSeriesList = new ArrayList<>();
            taskSeriesList.add("1");

            Home home = new Home("1",
                    "Test",
                    new Address("1",
                            "street",
                            "postCode",
                            "city",
                            "country"),
                    new ArrayList<>(),
                    taskSeriesList,
                    new HashMap<>());
            mockRepo.save(home);
            when(mockRepo.findById("1")).thenReturn(java.util.Optional.empty());
            //WHEN
            homeService.getHomeWithConnectedTask("1");
            //THEN
        }catch (HomeDoesNotExistException e){
            assertEquals("No Home with this TaskSeries found",e.getMessage());
        }
    }
    private static EditHomeDTO getEditHomeDTO() {
        Address updatedAddress = new Address("12", "new street", "new postCode", "new city", "new country");

        List<Item> newItemList = new ArrayList<>();
        newItemList.add(new Item("1", "Test", null, null));
        newItemList.add(new Item("2", "Test", null, null));

        List<String> newTaskSerisList = new ArrayList<>();
        newTaskSerisList.add("1");

        return new EditHomeDTO("Updated Home", updatedAddress,newItemList,newTaskSerisList);
    }

    private static TaskSeries createTaskSeries(){
        return new TaskSeries("1",
                new TaskDefinition("1_D",
                        "newTask",
                        new ArrayList<>(),
                        new ArrayList<>(),
                        new BigDecimal("10"),
                        Priority.HIGH,
                        3),
                new ArrayList<>());
    }

}