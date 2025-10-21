package org.example.backend.controller;


import org.example.backend.domain.home.Address;
import org.example.backend.domain.home.Home;
import org.example.backend.repro.HomeRepro;
import org.example.backend.service.security.IdService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
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
}