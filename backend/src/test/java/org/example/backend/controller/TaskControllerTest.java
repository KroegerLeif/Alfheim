package org.example.backend.controller;

import org.example.backend.repro.HomeRepro;
import org.example.backend.repro.TaskSeriesRepro;
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

import static org.mockito.Mockito.when;

@SpringBootTest
@AutoConfigureMockMvc
class TaskControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private TaskSeriesRepro taskSeriesRepro;

    @MockitoBean
    private IdService idService;

    @AfterEach
    void tearDown() {
        taskSeriesRepro.deleteAll();
    }

    @Test
    void createTask_shouldReturnCreatedTask_whenTaskIsCreated() throws Exception {
        //GIVEN
        when(idService.createNewId()).thenReturn("1");

        //WHEN
        mockMvc.perform(MockMvcRequestBuilders.post("/api/task/create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                """
                                    {
                                      "name" : "Test",
                                      "items": [],
                                      "priority": "HIGH",
                                      "dueDate" : "",
                                      "repetition": 0
                                    }
                                """
                        ))
                .andExpect(MockMvcResultMatchers.status().isCreated())
                .andExpect(MockMvcResultMatchers.content().json("""
                                    {
                                        "id": "11",
                                        "name": "Test",
                                        "items" : [],
                                        "assignedTo": [],
                                        "priority": "HIGH",
                                        "status": "OPEN",
                                        "dueDate" : null
                                      }
                       
                                    """));
    }
}