package org.example.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.backend.controller.dto.edit.EditItemDTO;
import org.example.backend.domain.item.Category;
import org.example.backend.domain.item.EnergyLabel;
import org.example.backend.domain.item.Item;
import org.example.backend.repro.ItemRepro;
import org.example.backend.service.security.IdService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.result.MockMvcResultMatchers;

@SpringBootTest
@AutoConfigureMockMvc
class ItemControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ItemRepro itemRepro;

    @MockitoBean
    private IdService idService;
    @Autowired
    private ObjectMapper objectMapper;

    @AfterEach
    void tearDown() {
        itemRepro.deleteAll();
    }

    @Test
    @WithMockUser
    void getAllItems_shouldReturnListOfAllItemsAsDTO_whenCalled() throws Exception {
        //GIVEN
        Item item = createItem();
        itemRepro.save(item);
        //WHEN
        mockMvc.perform(MockMvcRequestBuilders.get("/api/item"))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andExpect(MockMvcResultMatchers.content().json(
                                """
                                        [
                                          {
                                            "id":"10",
                                            "name":"test",
                                            "energyLabel":"A",
                                            "category":"Electronics"
                                          }
                                        ]
                                        """
                        )
                );

    }

    @Test
    @WithMockUser
    void deleteItem_shouldDeleteItem_whenCalled() throws Exception {
        //GIVEN
        Item item = createItem();
        itemRepro.save(item);

        //WHEN
        mockMvc.perform(MockMvcRequestBuilders.delete("/api/item/10/delete"))
                .andExpect(MockMvcResultMatchers.status().isAccepted());

        //THEN
        mockMvc.perform(MockMvcRequestBuilders.get("/api/item"))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andExpect(MockMvcResultMatchers.content().json("[]"));


    }

    @Test
    @WithMockUser
    void editItem_shouldReturnUpdatedItem_whenCalled() throws Exception {
        //GIVEN
        EditItemDTO editItemDTO = new EditItemDTO("Waschmaschine", null, null,"2");
        Item item = createItem();
        itemRepro.save(item);

        //WHEN
        mockMvc.perform(MockMvcRequestBuilders.patch("/api/item/10/edit")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(editItemDTO)))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andExpect(MockMvcResultMatchers.content().json(
                                """
                                        {
                                            "id":"10",
                                            "name":"Waschmaschine",
                                            "category" : "Electronics",
                                            "energyLabel" : "A"
                                        }
                                """));
    }


    private static Item createItem(){
        Category category = new Category("1", "Electronics");
        return new Item("10",
                "test",
                category,
                EnergyLabel.A,
                "home-123");
    }



}