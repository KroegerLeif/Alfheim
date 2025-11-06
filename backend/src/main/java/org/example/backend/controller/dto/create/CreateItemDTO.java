package org.example.backend.controller.dto.create;

import org.example.backend.domain.item.EnergyLabel;

public record CreateItemDTO(String name,
                            EnergyLabel energyLabel,
                            String category,
                            String homeId) {
}
