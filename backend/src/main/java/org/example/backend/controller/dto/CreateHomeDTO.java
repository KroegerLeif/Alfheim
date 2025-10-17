package org.example.backend.controller.dto;

import org.example.backend.domain.home.Address;

public record CreateHomeDTO(String name,
                            Address address) {
}
