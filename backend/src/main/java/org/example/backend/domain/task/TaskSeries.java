package org.example.backend.domain.task;

import lombok.With;
import org.springframework.lang.Nullable;

import java.util.List;

@With
public record TaskSeries(String id,
                         TaskDefinition definition,
                         List<Task> taskList,

                         @Nullable String homeId, // ENTWEDER homeId...

                         @Nullable List<String> ownerUserIds // ...ODER eine Liste von User-IDs
                         ) {
}
