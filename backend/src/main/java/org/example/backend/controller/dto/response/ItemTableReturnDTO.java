package org.example.backend.controller.dto.response;

import org.example.backend.domain.item.EnergyLabel;

import java.util.List;

public record ItemTableReturnDTO(String id,
                                 String name,
                                 EnergyLabel energyLabel,
                                 String category,
                                 List<TaskListReturn> tasks,
                                 HomeListReturnDTO homeData) {
}
