package org.example.backend.controller.dto.create;

import org.example.backend.domain.home.Address;

public record CreateHomeDTO(String name,
                            Address address) {
}
