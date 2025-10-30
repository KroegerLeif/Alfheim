package org.example.backend.controller;


import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.backend.controller.dto.edit.EditHomeDTO;
import org.example.backend.domain.home.Address;
import org.example.backend.domain.home.Home;
import org.example.backend.domain.item.Item;
import org.example.backend.domain.task.Priority;
import org.example.backend.domain.task.Task;
import org.example.backend.domain.task.TaskDefinition;
import org.example.backend.domain.task.TaskSeries;
import org.example.backend.domain.user.User;
import org.example.backend.repro.HomeRepro;
import org.example.backend.service.security.IdService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.result.MockMvcResultMatchers;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

import static org.mockito.Mockito.when;

@SpringBootTest
@AutoConfigureMockMvc
class HomeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private HomeRepro homeRepro;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private IdService idService;

    @AfterEach
    void tearDown() {
        homeRepro.deleteAll();
    }

    @Test
    void getAllHomes_shouldReturnEmptyList_whenNoHomesExist() throws Exception {
        mockMvc.perform(MockMvcRequestBuilders.get("/api/home"))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andExpect(MockMvcResultMatchers.content().json("[]"));
    }

    @Test
    void getAllHomes_shouldReturnListOfHomes_whenHomesExist() throws Exception {
        Address address = new Address("1", "street", "postCode", "city", "country");
        Home home = new Home("1", "home", address, new ArrayList<>(), new ArrayList<>(), new HashMap<>());
        homeRepro.save(home);

        mockMvc.perform(MockMvcRequestBuilders.get("/api/home"))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andExpect(MockMvcResultMatchers.content().json(
                        """
                                    [
                                      {
                                        "id": "1",
                                        "name": "home",
                                        "address": {
                                          "id": "1",
                                          "street": "street",
                                          "postCode": "postCode",
                                          "city": "city",
                                          "country": "country"
                                        },
                                        "admin": "admin",
                                        "numberTask": 0,
                                        "numberItems": 0,
                                        "members" : []
                                      }
                                    ]
                                    """));
    }

    @Test
    void getHomeNames_shouldReturnListOfHomeNames_whenHomesExist() throws Exception {
        Address address = new Address("1", "street", "postCode", "city", "country");
        Home home = new Home("1", "home", address, new ArrayList<>(), new ArrayList<>(), new HashMap<>());
        homeRepro.save(home);

        mockMvc.perform(MockMvcRequestBuilders.get("/api/home/getNames"))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andExpect(MockMvcResultMatchers.content().json(
                        """
                                    [
                                      {
                                        "id": "1",
                                        "name": "home"
                                      }
                                    ]
                                    """));
    }

    @Test
    void createHome_shouldReturnCreatedHome_whenHomeIsCreated() throws Exception {
        //GIVEN
        when(idService.createNewId()).thenReturn("1");

        //WHEN
        mockMvc.perform(MockMvcRequestBuilders.post("/api/home/create")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                            {
                              "name" : "Test",
                              "address": {
                                          "id": "1",
                                          "street": "street",
                                          "postCode": "postCode",
                                          "city": "city",
                                          "country": "country"
                                        }
                            }
                        """
                ))
                .andExpect(MockMvcResultMatchers.status().isCreated())
                .andExpect(MockMvcResultMatchers.content().json("""
                                    {
                                        "id": "1",
                                        "name": "Test",
                                        "address": {
                                          "id": "1",
                                          "street": "street",
                                          "postCode": "postCode",
                                          "city": "city",
                                          "country": "country"
                                        },
                                        "admin": "admin",
                                        "numberTask": 0,
                                        "numberItems": 0,
                                        "members" : []
                                      }
                       
                                    """));

    }

    @Test
    void editHome_shouldUpdateAllFields_whenAllFieldsAreProvided()throws Exception{
        //GIVEN
        Address originalAddress = new Address("12", "street", "postCode", "city", "country");
        Home home = new Home("1", "home", originalAddress, new ArrayList<>(), new ArrayList<>(), new HashMap<>());
        homeRepro.save(home);

        EditHomeDTO editHomeDTO = getEditHomeDTO();


        //WHEN
        mockMvc.perform(MockMvcRequestBuilders.patch("/api/home/1/edit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(editHomeDTO)))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andExpect(MockMvcResultMatchers.content().json("""
                                    {
                                        "id": "1",
                                        "name": "Updated Home",
                                        "address": {
                                          "id": "12",
                                          "street": "new street",
                                          "postCode": "new postCode",
                                          "city": "new city",
                                          "country": "new country"
                                        },
                                        "admin": "admin",
                                        "numberItems": 2,
                                        "numberTask": 1,
                                        "members" : []
                                      }
                       
                                    """));
    }

    @Test
    void editHome_shouldUpdateOnlyName_whenOnlyNameIsProvided() throws Exception {
        // GIVEN
        Address originalAddress = new Address("12", "street", "postCode", "city", "country");
        Home home = new Home("1", "home", originalAddress, new ArrayList<>(), new ArrayList<>(), new HashMap<>());
        homeRepro.save(home);

        EditHomeDTO editHomeDTO = new EditHomeDTO("Updated Name", null, null, null);

        // WHEN
        mockMvc.perform(MockMvcRequestBuilders.patch("/api/home/1/edit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(editHomeDTO)))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andExpect(MockMvcResultMatchers.content().json("""
                    {
                        "id": "1",
                        "name": "Updated Name",
                        "address": {
                          "id": "12",
                          "street": "street",
                          "postCode": "postCode",
                          "city": "city",
                          "country": "country"
                        },
                        "numberItems": 0,
                        "numberTask": 0
                    }
                    """));
    }

    @Test
    void editHome_shouldUpdateOnlyAddress_whenOnlyAddressIsProvided() throws Exception {
        // GIVEN
        Address originalAddress = new Address("12", "street", "postCode", "city", "country");
        Home home = new Home("1", "home", originalAddress, new ArrayList<>(), new ArrayList<>(), new HashMap<>());
        homeRepro.save(home);

        Address updatedAddress = new Address("12", "new street", "new postCode", "new city", "new country");
        EditHomeDTO editHomeDTO = new EditHomeDTO(null, updatedAddress, null, null);

        // WHEN
        mockMvc.perform(MockMvcRequestBuilders.patch("/api/home/1/edit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(editHomeDTO)))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andExpect(MockMvcResultMatchers.content().json("""
                    {
                        "id": "1",
                        "name": "home",
                        "address": {
                          "id": "12",
                          "street": "new street",
                          "postCode": "new postCode",
                          "city": "new city",
                          "country": "new country"
                        },
                        "numberItems": 0,
                        "numberTask": 0
                    }
                    """));
    }

    @Test
    void editHome_shouldUpdateOnlyItems_whenOnlyItemsAreProvided() throws Exception {
        // GIVEN
        Address originalAddress = new Address("12", "street", "postCode", "city", "country");
        Home home = new Home("1", "home", originalAddress, new ArrayList<>(), new ArrayList<>(), new HashMap<>());
        homeRepro.save(home);

        List<Item> newItemList = new ArrayList<>();
        newItemList.add(new Item("1", "Test", null, null));
        EditHomeDTO editHomeDTO = new EditHomeDTO(null, null, newItemList, null);

        // WHEN
        mockMvc.perform(MockMvcRequestBuilders.patch("/api/home/1/edit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(editHomeDTO)))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andExpect(MockMvcResultMatchers.content().json("""
                    {
                        "id": "1",
                        "name": "home",
                        "address": {
                          "id": "12",
                          "street": "street",
                          "postCode": "postCode",
                          "city": "city",
                          "country": "country"
                        },
                        "numberItems": 1,
                        "numberTask": 0
                    }
                    """));
    }

    @Test
    void editHome_shouldUpdateOnlyTaskSeries_whenOnlyTaskSeriesAreProvided() throws Exception {
        // GIVEN
        Address originalAddress = new Address("12", "street", "postCode", "city", "country");
        Home home = new Home("1", "home", originalAddress, new ArrayList<>(), new ArrayList<>(), new HashMap<>());
        homeRepro.save(home);

        List<TaskSeries> newTaskSeriesList = new ArrayList<>();
        newTaskSeriesList.add(new TaskSeries("1", new TaskDefinition("1_D", "test", new ArrayList<>(), new ArrayList<>(), new BigDecimal(10), Priority.HIGH, 5), new ArrayList<>()));
        EditHomeDTO editHomeDTO = new EditHomeDTO(null, null, null, newTaskSeriesList);

        // WHEN
        mockMvc.perform(MockMvcRequestBuilders.patch("/api/home/1/edit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(editHomeDTO)))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andExpect(MockMvcResultMatchers.content().json("""
                    {
                        "id": "1",
                        "name": "home",
                        "address": {
                          "id": "12",
                          "street": "street",
                          "postCode": "postCode",
                          "city": "city",
                          "country": "country"
                        },
                        "numberItems": 0,
                        "numberTask": 1
                    }
                    """));
    }

    @Test
    void deleteHome_shouldDeleteHome_whenCalled() throws Exception {
        //GIVEN
        Address address = new Address("1", "street", "postCode", "city", "country");
        Home home = new Home("1", "home", address, new ArrayList<>(), new ArrayList<>(), new HashMap<>());
        homeRepro.save(home);

        //WHEN
        mockMvc.perform(MockMvcRequestBuilders.delete("/api/home/1/delete"))
                .andExpect(MockMvcResultMatchers.status().isAccepted());

        //THEN
        mockMvc.perform(MockMvcRequestBuilders.get("/api/home"))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andExpect(MockMvcResultMatchers.content().json("[]"));

    }
    private static EditHomeDTO getEditHomeDTO() {
        Address updatedAddress = new Address("12", "new street", "new postCode", "new city", "new country");

        List<Item> newItemList = new ArrayList<>();
        newItemList.add(new Item("1", "Test", null, null));
        newItemList.add(new Item("2", "Test", null, null));

        List<TaskSeries> newTaskSerisList = new ArrayList<>();
        newTaskSerisList.add(new TaskSeries("1",
                new TaskDefinition("1_D",
                        "test",
                        new ArrayList<User>(),
                        new ArrayList<Item>(),
                        new BigDecimal(10),
                        Priority.HIGH,
                        5
                )
                ,new ArrayList<Task>())
        );

        return new EditHomeDTO("Updated Home", updatedAddress,newItemList,newTaskSerisList);
    }
}
