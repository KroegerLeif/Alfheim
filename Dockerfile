FROM --platform=linux/amd64 openjdk:21
EXPOSE 8040
ADD backend/target/alfheim.jar alfheim.jar
ENTRYPOINT ["java", "jar", "alfheim.jar"]