package org.example.backend.repro;

import org.example.backend.domain.task.Task;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface TaskRepro extends MongoRepository<Task, String> {
}
