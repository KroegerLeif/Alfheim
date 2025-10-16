package org.example.backend.controller.dto;

import org.example.backend.domain.home.Address;

import java.util.List;

public record HomeTableReturnDTO(String name,
                                 Address address,
                                 String admin,
                                 int numberTAsk,
                                 int numberItems,
                                 List<String> members) {
}
