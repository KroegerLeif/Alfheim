package org.example.backend.controller.dto;

import org.example.backend.domain.item.EnergyLabel;

public record CreateTableDTO(String name,
                             EnergyLabel energyLabel,
                             String category) {
}
