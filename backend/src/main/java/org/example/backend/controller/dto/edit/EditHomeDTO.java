package org.example.backend.controller.dto.edit;

import org.example.backend.domain.home.Address;
import org.example.backend.domain.item.Item;
import org.example.backend.domain.task.TaskSeries;

import java.util.List;

public record EditHomeDTO(String name,
                          Address address,
                          List<Item> items,
                          List<TaskSeries> taskSeriesList) {
}
