package org.example.backend.controller.dto.edit;

import org.example.backend.domain.item.Category;
import org.example.backend.domain.item.EnergyLabel;

public record EditItemDTO(String name,
                          Category category,
                          EnergyLabel energyLabel) {
}
