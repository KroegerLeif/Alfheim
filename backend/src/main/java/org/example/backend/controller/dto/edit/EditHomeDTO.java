package org.example.backend.controller.dto.edit;

import org.example.backend.domain.home.Address;

public record EditHomeDTO(String name,
                          Address address) {

}
