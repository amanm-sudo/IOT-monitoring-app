# UGQ - AI IoT Dashboard

A high-performance, real-time IoT monitoring dashboard designed for industrial sensor data visualization. Built with a modern "Deep Space Glassmorphism" aesthetic, this application provides live insights into energy consumption, power quality, and system health.

## 🚀 Features

-   **Real-time Monitoring**: Live data streaming from ESP32/Modbus sensors via Socket.IO.
-   **AI-Powered Insights**: Predictive analytics for risk assessment and anomaly detection.
-   **Interactive Visualization**: Dynamic charts (Recharts) and gauges for instant status checks.
-   **Premium UI**: Custom "Deep Space" theme with glassmorphism effects, neon accents, and smooth animations.
-   **Responsive Design**: Fully optimized for desktop and tablet interfaces.

## 🛠️ Tech Stack

### Frontend
-   **Framework**: React 19 + Vite
-   **Styling**: Vanilla CSS (Custom Variables & Glassmorphism)
-   **State/Data**: Socket.io-client, Recharts
-   **Icons**: Lucide React

### Backend
-   **Runtime**: Node.js
-   **Framework**: Express.js
-   **Database**: PostgreSQL
-   **Communication**: Socket.IO (Real-time), REST API

### Hardware / Firmware
-   **Controller**: ESP32
-   **Protocol**: Modbus RTU (RS485)
-   **Firmware**: C++ (Arduino Framework)

## 📂 Project Structure

```
UGQ/
├── src/                # Frontend source code (React)
│   ├── components/     # Reusable UI components (Charts, Sensors, Lists)
│   ├── services/       # API and Socket services
│   └── App.jsx         # Main application entry
├── server/             # Backend source code (Node.js)
│   ├── server.js       # Express & Socket.IO server
│   ├── db.js          # Database connection
│   └── schema.sql      # Database schema
└── firmware/           # ESP32 Firmware code
```

## ⚡ Getting Started

### Prerequisites
-   Node.js (v18+)
-   PostgreSQL
-   Git

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/amanm-sudo/UGQ.git
    cd UGQ
    ```

2.  **Setup Backend**
    ```bash
    cd server
    npm install
    # Create a .env file with your DB credentials
    npm run dev
    ```

3.  **Setup Frontend**
    ```bash
    # Open a new terminal in the project root
    npm install
    npm run dev
    ```

4.  **Database Setup**
    Import the `server/schema.sql` file into your PostgreSQL database to set up the necessary tables.

## 📄 License
This project is licensed under the ISC License.
