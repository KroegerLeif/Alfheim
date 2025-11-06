package org.example.backend.repro;

import org.example.backend.domain.task.TaskSeries;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskSeriesRepro extends MongoRepository<TaskSeries, String> {

    TaskSeries getTaskSeriesById(String number);
    List<TaskSeries> findAllByTaskMembersContaining(String userId);
    List<TaskSeries> findAllByHomeId(String homeId);
}
