package org.example.backend.repro;

import org.example.backend.domain.task.TaskSeries;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface TaskSeriesRepro extends MongoRepository<TaskSeries, String> {

    TaskSeries getTaskSeriesById(String number);
}
