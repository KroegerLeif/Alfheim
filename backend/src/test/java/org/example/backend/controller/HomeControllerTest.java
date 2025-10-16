package org.example.backend.controller;


import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.result.MockMvcResultMatchers;

import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

@SpringBootTest
@AutoConfigureMockMvc
class HomeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private MockRestServiceServer mockRestServiceServer;

    @Test
    void getAllHomes_shouldReturnEmptyList_whenNoHomesExist() throws Exception {
        //GIVEN
        mockRestServiceServer.expect(requestTo("/api/home"))
                .andRespond((withSuccess(
                        """
                            []    
                         """, MediaType.APPLICATION_JSON)));
        //WHEN & THEN
        mockMvc.perform(MockMvcRequestBuilders.get("/api/home"))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andExpect(MockMvcResultMatchers.content().json(
                        """
                            []    
                         """));
    }

    @Test
    void getAllHomes_shouldReturnListOfHomes_whenHomesExist() throws Exception {
        //GIVEN
        mockRestServiceServer.expect(requestTo("/api/home"))
                .andRespond((withSuccess(
                        """
                            [
                                {
                                    "name" : "haus",
                                    "address" : "test"
                                }
                            ]    
                         """, MediaType.APPLICATION_JSON)));
        //WHEN & THEN
        mockMvc.perform(MockMvcRequestBuilders.get("/api/home"))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andExpect(MockMvcResultMatchers.content().json(
                        """
                            [
                                {
                                    "name" : "haus",
                                    "address" : "test"
                                }
                            ]    
                         """));
    }
}