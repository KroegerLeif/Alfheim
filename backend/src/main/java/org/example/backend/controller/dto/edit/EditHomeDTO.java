package org.example.backend.controller.dto.edit;

import org.example.backend.domain.home.Address;

import java.util.List;

public record EditHomeDTO(String name,
                          Address address,
                          List<String> associatedUsers) {
}
