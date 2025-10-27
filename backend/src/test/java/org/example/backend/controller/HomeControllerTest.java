package org.example.backend.controller;


import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.backend.controller.dto.edit.EditHomeDTO;
import org.example.backend.domain.home.Address;
import org.example.backend.domain.home.Home;
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

import java.util.ArrayList;
import java.util.HashMap;

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
    void editHome_shouldReturnUpdatedHome_whenHomeIsEdited()throws Exception{
        //GIVEN
        Address originalAddress = new Address("12", "street", "postCode", "city", "country");
        Home home = new Home("1", "home", originalAddress, new ArrayList<>(), new ArrayList<>(), new HashMap<>());
        homeRepro.save(home);

        Address updatedAddress = new Address("12", "new street", "new postCode", "new city", "new country");
        EditHomeDTO editHomeDTO = new EditHomeDTO("Updated Home", updatedAddress);


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
                                        "numberTask": 0,
                                        "numberItems": 0,
                                        "members" : []
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
}