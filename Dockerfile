FROM --platform=linux/amd64 openjdk:21
EXPOSE 8040
ADD backend/target/Alfheim.jar alfheim.jar
ENTRYPOINT ["java", "jar", "alfheim.jar"]