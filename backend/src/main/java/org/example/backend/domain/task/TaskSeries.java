package org.example.backend.domain.task;

import lombok.With;

import java.util.List;

@With
public record TaskSeries(String id,
                         TaskDefinition definition,
                         List<Task> taskList,
                         String homeId,
                         List<String> homeMembers) {
}