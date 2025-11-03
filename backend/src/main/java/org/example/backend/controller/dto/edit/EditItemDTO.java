package org.example.backend.controller.dto.edit;

import org.example.backend.domain.item.EnergyLabel;

public record EditItemDTO(String name,
                          String category,
                          EnergyLabel energyLabel,
                          String homeId) {
}
