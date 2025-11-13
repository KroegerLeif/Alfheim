# Alfheim

A comprehensive home maintenance management application that helps you track your properties, manage household items, and schedule maintenance tasks.

## Overview

Alfheim is a full-stack web application designed to simplify home management. Whether you own one property or multiple, Alfheim helps you organize household items, track their categories and energy labels, and manage maintenance tasks with deadlines and recurring schedules.

## Features

### 🏠 Home Management
- Create and manage multiple properties
- Track property addresses and details
- Multi-user homes with role-based access control
- View all your properties in one dashboard

### 📦 Item Management
- Catalog household items by property
- Categorize items (e.g., appliances, furniture, electronics)
- Track energy efficiency labels
- Associate items with specific homes

### ✅ Task Management
- Create maintenance and household tasks
- Set due dates and priorities
- Track task status (pending, in progress, completed)
- Link tasks to specific items or homes
- Support for recurring tasks (task series)

### 🔐 Authentication
- OAuth2 integration with GitHub and Google
- Secure user authentication
- Multi-user support with proper authorization

## Tech Stack

### Backend
- **Java 21**
- **Spring Boot 3.5.6**
- **Spring Security** with OAuth2
- **MongoDB** for data persistence
- **Maven** for build management
- **Lombok** for reduced boilerplate
- **JaCoCo** for code coverage

### Frontend
- **React 19** with TypeScript
- **Vite** for fast development and building
- **React Router** for navigation
- **TailwindCSS** for styling
- **shadcn/ui** for UI components (built on Radix UI)
- **Radix UI** for accessible primitives
- **Axios** for API communication
- **React Hook Form** for form management
- **Lucide React** for icons

## Prerequisites

Before you begin, ensure you have the following installed:

- **Java 21** or higher
- **Maven 3.6+**
- **Node.js 18+** and **npm** or **yarn**
- **MongoDB** (local installation or cloud instance like MongoDB Atlas)
- **Git**

### OAuth2 Setup

You'll need to create OAuth2 applications for authentication:

1. **GitHub OAuth App**
   - Go to GitHub Settings → Developer settings → OAuth Apps
   - Create a new OAuth App
   - Set Authorization callback URL to: `http://localhost:8080/login/oauth2/code/github`
   - Note your Client ID and Client Secret

2. **Google OAuth App**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Set Authorized redirect URI to: `http://localhost:8080/login/oauth2/code/google`
   - Note your Client ID and Client Secret

## Installation

### Backend Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/KroegerLeif/Alfheim.git
   cd Alfheim/backend
   ```

2. **Configure environment variables**
   
   Create a `.env` file or set environment variables:
   ```bash
   export MONGODB_URI="mongodb://localhost:27017/alfheim"
   export GITHUB_CLIENT_ID="your_github_client_id"
   export GITHUB_CLIENT_SECRET="your_github_client_secret"
   export GOOGLE_CLIENT_ID="your_google_client_id"
   export GOOGLE_CLIENT_SECRET="your_google_client_secret"
   export APP_URL="http://localhost:5173"
   ```

   For MongoDB Atlas, use a connection string like:
   ```
   mongodb+srv://<username>:<password>@<cluster>.mongodb.net/alfheim
   ```

3. **Build the backend**
   ```bash
   mvn clean install
   ```

4. **Run the backend**
   ```bash
   mvn spring-boot:run
   ```

   The backend will start on `http://localhost:8080`

### Frontend Setup

1. **Navigate to the frontend directory**
   ```bash
   cd ../frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure API endpoint (if needed)**
   
   The frontend is configured to connect to `http://localhost:8080` by default. If your backend runs on a different port, update the API base URL in your frontend configuration.

4. **Start the development server**
   ```bash
   npm run dev
   ```

   The frontend will start on `http://localhost:5173`

## Running the Application

### Option 1: Using Docker (Recommended)

The easiest way to run Alfheim is using the pre-built Docker image from Docker Hub:

```bash
docker pull leifkroegerdocker/alfheim:latest
docker run -p 8080:8080 \
  -e MONGODB_URI="your_mongodb_uri" \
  -e GITHUB_CLIENT_ID="your_github_client_id" \
  -e GITHUB_CLIENT_SECRET="your_github_client_secret" \
  -e GOOGLE_CLIENT_ID="your_google_client_id" \
  -e GOOGLE_CLIENT_SECRET="your_google_client_secret" \
  -e APP_URL="http://localhost:5173" \
  leifkroegerdocker/alfheim:latest
```

**Note**: Make sure to replace the environment variable values with your actual credentials.

### Option 2: Manual Setup

1. **Start MongoDB** (if running locally)
   ```bash
   mongod
   ```

2. **Start the Backend**
   ```bash
   cd backend
   mvn spring-boot:run
   ```

3. **Start the Frontend** (in a new terminal)
   ```bash
   cd frontend
   npm run dev
   ```

4. **Access the application**
   
   Open your browser and navigate to `http://localhost:5173`

5. **Login**
   
   Click on the login button and authenticate using GitHub or Google

## API Endpoints

### Home Endpoints
- `GET /api/home` - Get all homes for the authenticated user
- `GET /api/home/getNames` - Get home names for dropdowns
- `POST /api/home/create` - Create a new home
- `PATCH /api/home/{id}/edit` - Edit a home
- `DELETE /api/home/{id}/delete` - Delete a home

### Item Endpoints
- `GET /api/item` - Get all items for the authenticated user
- `GET /api/item/getNames` - Get item names for dropdowns
- `POST /api/item/create` - Create a new item
- `PATCH /api/item/{id}/edit` - Edit an item
- `DELETE /api/item/{id}/delete` - Delete an item

### Task Endpoints
- `GET /api/task` - Get all tasks for the authenticated user
- `POST /api/task/create` - Create a new task
- `PATCH /api/task/{id}/edit-task` - Edit a task
- `PATCH /api/task/{id}/editTaskSeries` - Edit a task series
- `DELETE /api/task/{id}/delete` - Delete a task

## Project Structure

```
Alfheim/
├── backend/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/org/example/backend/
│   │   │   │   ├── controller/        # REST controllers
│   │   │   │   ├── domain/           # Domain models
│   │   │   │   ├── repro/            # Repositories
│   │   │   │   └── service/          # Business logic
│   │   │   └── resources/
│   │   │       └── application.properties
│   │   └── test/                     # Unit and integration tests
│   └── pom.xml
├── frontend/
│   ├── src/
│   │   ├── components/               # Reusable UI components
│   │   ├── dto/                      # TypeScript DTOs
│   │   ├── pages/                    # Page components
│   │   │   ├── home/                # Home management pages
│   │   │   ├── item/                # Item management pages
│   │   │   └── task/                # Task management pages
│   │   └── main.tsx                 # Application entry point
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## Building for Production

### Backend
```bash
cd backend
mvn clean package
java -jar target/backend-0.0.1-SNAPSHOT.jar
```

### Frontend
```bash
cd frontend
npm run build
npm run preview
```

The built files will be in the `frontend/dist` directory.

## Testing

### Backend Tests
```bash
cd backend
mvn test
```

### Frontend Linting
```bash
cd frontend
npm run lint
```

## Code Quality

### SonarCloud Integration

This project uses [SonarCloud](https://sonarcloud.io/) for continuous code quality inspection of the backend. The analysis runs automatically on:
- Push to the `master` branch
- Pull request creation and updates

You can view the code quality reports at the SonarCloud dashboard for the project.

The SonarCloud analysis includes:
- Code coverage tracking with JaCoCo
- Bug detection
- Security vulnerability scanning
- Code smell identification
- Technical debt assessment

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is currently in development. License information will be added soon.

## Contact

Leif Kroeger - [@KroegerLeif](https://github.com/KroegerLeif)

Project Link: [https://github.com/KroegerLeif/Alfheim](https://github.com/KroegerLeif/Alfheim)
