package org.example.backend.service.mapper;

import org.example.backend.controller.dto.create.CreateHomeDTO;
import org.example.backend.controller.dto.response.HomeTableReturnDTO;
import org.example.backend.domain.home.Address;
import org.example.backend.domain.home.Home;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;

import static org.junit.jupiter.api.Assertions.assertEquals;

class HomeMapperTest {

    private final HomeMapper homeMapper = new HomeMapper();

    @Test
    void mapToHome() {
        //GIVEN
        Address address = new Address("1", "street", "postCode", "city", "country");
        CreateHomeDTO createHomeDTO = new CreateHomeDTO("Test",address);
        var expected = new Home("",
                    "Test",
                    address,
                    new ArrayList<>(),
                    new ArrayList<>(),
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
        Home home = new Home("1", "home", address, new ArrayList<>(), new ArrayList<>(), new HashMap<>());
        var expected = new HomeTableReturnDTO("1",
                                            "home",
                                                address,
                                        "admin",
                                        0,
                                        0,
                                                new ArrayList<>());
        //WHEN
        var actual = homeMapper.mapToHomeTableReturn(home);

        //THEN
        assertEquals(expected,actual);

    }
}