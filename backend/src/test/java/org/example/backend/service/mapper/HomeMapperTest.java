package org.example.backend.service.mapper;

import org.example.backend.controller.dto.create.CreateHomeDTO;
import org.example.backend.controller.dto.response.HomeTableReturnDTO;
import org.example.backend.domain.home.Address;
import org.example.backend.domain.home.Home;
import org.example.backend.service.UserService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.ArrayList;
import java.util.HashMap;

import static org.junit.jupiter.api.Assertions.assertEquals;

class HomeMapperTest {

    private final UserService userService = Mockito.mock(UserService.class);

    private final HomeMapper homeMapper = new HomeMapper(userService);

    @Test
    void mapToHome() {
        //GIVEN
        Address address = new Address("1", "street", "postCode", "city", "country");
        CreateHomeDTO createHomeDTO = new CreateHomeDTO("Test",address);
        var expected = new Home("",
                    "Test",
                    address,
                    new HashMap<>());

        //WHEN
        var actual = homeMapper.mapToHome(createHomeDTO);

        //THEN
        assertEquals(expected,actual);

    }

    @Test
    void mapToHomeTableReturn() {
        //GIVEN
        Address address = new Address("1", "street", "postCode", "city", "country");
        Home home = new Home("1", "home", address, new HashMap<>());
        var expected = new HomeTableReturnDTO("1",
                                            "home",
                                                address,
                                        null,
                                        0,
                                        0,
                                                new ArrayList<>());
        //WHEN
        var actual = homeMapper.mapToHomeTableReturn(home);
        //THEN
        assertEquals(expected,actual);
    }
}