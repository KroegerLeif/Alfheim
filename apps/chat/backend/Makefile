.PHONY: build run test lint clean docker-build

APP_NAME=chat-backend
BUILD_DIR=bin

build:
	@echo "Building $(APP_NAME)..."
	@go build -o $(BUILD_DIR)/$(APP_NAME) ./cmd/server

run: build
	@echo "Running $(APP_NAME)..."
	@./$(BUILD_DIR)/$(APP_NAME)

test:
	@echo "Running tests..."
	@go test -v ./...

lint:
	@echo "Running golangci-lint..."
	@golangci-lint run ./...

clean:
	@echo "Cleaning build artifacts..."
	@rm -rf $(BUILD_DIR)

docker-build:
	@echo "Building docker image..."
	@docker build -t alfheim/$(APP_NAME):latest .
