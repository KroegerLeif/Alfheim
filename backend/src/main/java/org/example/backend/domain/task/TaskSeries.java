package org.example.backend.domain.task;

import java.util.List;

public record TaskSeries(String id,
                         TaskDefinition definition,
                         List<Task> taskList) {
}
