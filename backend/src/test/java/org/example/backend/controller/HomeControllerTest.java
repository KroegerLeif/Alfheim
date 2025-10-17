package org.example.backend.controller;

import org.example.backend.domain.home.Address;
import org.example.backend.domain.home.Home;
import org.example.backend.repro.HomeRepro;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.result.MockMvcResultMatchers;

import java.util.ArrayList;
import java.util.HashMap;

@SpringBootTest
@AutoConfigureMockMvc
class HomeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private HomeRepro homeRepro;

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
}