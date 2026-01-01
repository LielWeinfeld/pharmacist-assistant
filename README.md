# AI-powered pharmacist assistant

## Description

An AI-powered conversational pharmacist assistant designed to support customers of a retail pharmacy chain. The assistant enables users to check medication stock availability, handle prescription-related questions, and access factual medication information based exclusively on internal data sources and official consumer leaflets.

The system does **not** provide medical advice or diagnoses. Requests for medical guidance are explicitly redirected to qualified healthcare professionals.

The assistant supports both English and Hebrew and delivers responses in real-time.

All inventory and business logic is implemented outside the AI model, ensuring accuracy, safety, and deterministic behavior.

## Architecture

The system follows a layered architecture:

- **Frontend (React + Vite)** - Provides a chat interface and consumes streamed responses via Server-Sent Events (SSE).
- **Backend (Node.js + Express)** - Handles request validation, language detection, and all deterministic business and inventory logic.
- **AI Layer (OpenAI)** - Used to generate responses and present factual medication information based on database and consumer leaflets.

## Getting Started

### Dependencies

- Docker
- Docker Compose
- Node 18+ (only if running without Docker)
- An OpenAI API key

### Installing

1. Clone or download the repository:

```bash
git clone https://github.com/LielWeinfeld/pharmacist-assistant.git
cd pharmacist-assistant
```

2. Create a `.env` file in the project root:

```.env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-5
```

**Note: Do Not Commit `.env` File.**

### Executing program

#### Run using Docker

1. Make sure Docker Desktop is installed and running.

2. From the project root, build and start the services:

```bash
docker compose up --build
```

3. Open the application:

- http://localhost:8080

#### Run without Docker

1. Start the backend:

```bash
cd backend
npm install
npm run dev
```

2. Start the frontend:

```bash
cd frontend
npm install
npm run dev
```

## Help

### Common issues:

- **Missing API key** - Make sure OPENAI_API_KEY is set in the root `.env` file.

- **Ports already in use** - Stop any services running on ports `3001` or `5173`.

- **No response from assistant** - Verify that the backend container or server is running and streaming is not blocked by proxy.

## Authors

Liel Weinfeld

## License

This project is licensed under the MIT License.
