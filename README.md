
Built by https://www.blackbox.ai

---

```markdown
# WhatsApp Financial Assistant

## Project Overview

The WhatsApp Financial Assistant is a chatbot application designed to assist users with financial queries via WhatsApp. Leveraging Natural Language Processing (NLP) capabilities, this bot can understand and respond to user inquiries effectively, making it a powerful tool for managing financial information and transactions.

## Installation

To set up the WhatsApp Financial Assistant, follow the steps below:

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/whatsapp-financial-assistant.git
   cd whatsapp-financial-assistant
   ```

2. Install the necessary dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory and configure your environment variables as needed.

## Usage

To run the application in development mode, use the following command:
```bash
npm run dev
```

For production:
```bash
npm start
```

To run the tests, execute:
```bash
npm test
```

## Features

- **Natural Language Processing:** Understands user inquiries and provides accurate financial responses.
- **WhatsApp Integration:** Communicates directly through WhatsApp using venom-bot and whatsapp-web.js.
- **Secure Authentication:** User security is enhanced via JSON Web Tokens (JWT) and password hashing with bcryptjs.
- **Data Persistence:** Uses MongoDB with Mongoose for storing user data and interactions.
- **CORS Support:** Ensures compatibility with various client applications through the CORS middleware.
- **Date Handling:** Manages and formats dates effortlessly using Moment.js.
- **API Communication:** Utilizes Axios for making HTTP requests to external services.

## Dependencies

The project utilizes the following dependencies as noted in `package.json`:

- **express:** ^4.18.2 - Framework for building web applications.
- **cors:** ^2.8.5 - Middleware to enable Cross-Origin Resource Sharing.
- **mongoose:** ^7.5.0 - MongoDB object modeling tool.
- **dotenv:** ^16.3.1 - Loads environment variables from a .env file.
- **bcryptjs:** ^2.4.3 - Library to hash passwords.
- **jsonwebtoken:** ^9.0.1 - Implementation of JSON Web Token for authenticating users.
- **venom-bot:** ^5.0.1 - WhatsApp bot framework.
- **whatsapp-web.js:** ^1.22.1 - Library for WhatsApp Web API.
- **node-nlp:** ^4.27.0 - Library for natural language processing.
- **axios:** ^1.4.0 - Promise-based HTTP client for the browser and Node.js.
- **moment:** ^2.29.4 - Library for parsing, validating, manipulating, and displaying dates.

### Development Dependencies

- **nodemon:** ^3.0.1 - Tool for automatically restarting Node.js applications.
- **jest:** ^29.6.2 - JavaScript testing framework.

## Project Structure

The project structure is organized as follows:

```
whatsapp-financial-assistant/
├── server/                # Main server directory
│   ├── index.js           # Entry point for the application
│   └── ...                # Other server-related files
├── .env                   # Environment configuration file
├── package.json           # Project dependencies and scripts
└── README.md              # Project documentation
```

This structure is designed to maintain a clear separation of concerns between the different components of the application.

For any questions, contributions, or suggestions, please contact the project maintainer.
```