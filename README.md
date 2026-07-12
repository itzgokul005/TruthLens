# 📰 TruthLens – AI-Powered Fake News Detection System

![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)
![Flask](https://img.shields.io/badge/Flask-Web%20Framework-black?logo=flask)
![SQLite](https://img.shields.io/badge/Database-SQLite-blue)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6-yellow?logo=javascript)
![HTML5](https://img.shields.io/badge/HTML5-orange?logo=html5)
![CSS3](https://img.shields.io/badge/CSS3-blue?logo=css3)
![License](https://img.shields.io/badge/License-MIT-green)

## 📖 Overview

**TruthLens** is an AI-powered fake news detection web application developed using **Python Flask**. It helps users verify the credibility of news articles by analyzing their content and classifying them as **Real**, **Fake**, or **Satire**. The system provides confidence scores, detailed explanations, and maintains a history of previous analyses.

Designed with a modern and responsive interface, TruthLens enables users to make informed decisions about online information while promoting media literacy and combating misinformation.

---

# ✨ Features

* 🔍 AI-powered article verification
* 📰 Detects **Real**, **Fake**, and **Satire** news
* 📊 Confidence score visualization
* 🤖 AI-generated explanation for predictions
* 🖼️ Image verification support
* 👤 User authentication (Login & Registration)
* 📜 Analysis history
* 📱 Fully responsive design
* 🎨 Modern dashboard interface
* 🔒 Secure authentication and password hashing
* ⚡ Fast Flask backend
* 💾 SQLite database support
* 🌙 Clean and user-friendly UI

---

# 🛠️ Tech Stack

### Backend

* Python
* Flask
* SQLAlchemy
* Flask-Login
* Flask-Migrate
* Werkzeug

### Frontend

* HTML5
* CSS3
* JavaScript (ES6)
* Bootstrap

### Database

* SQLite

### AI & APIs

* Google Gemini API (for AI-powered analysis)
* NLP-based content verification

---

# 📂 Project Structure

```text
truthlens_flask/
│
├── app.py
├── wsgi.py
├── config.py
├── requirements.txt
├── .env.example
│
├── models/
├── routes/
├── services/
├── utils/
├── templates/
├── static/
├── migrations/
├── instance/
└── README.md
```

---

# 🚀 Installation

## Clone the repository

```bash
git clone https://github.com/your-username/truthlens.git
cd truthlens
```

## Create a virtual environment

### Windows

```bash
python -m venv venv
venv\Scripts\activate
```

### Linux / macOS

```bash
python3 -m venv venv
source venv/bin/activate
```

---

## Install dependencies

```bash
pip install -r requirements.txt
```

---

## Configure environment variables

Create a `.env` file based on `.env.example` and add your configuration:

```env
SECRET_KEY=your_secret_key
DATABASE_URL=sqlite:///truthlens.db
GEMINI_API_KEY=your_api_key
```

---

## Run the application

```bash
python app.py
```

or

```bash
flask run
```

Open your browser and visit:

```text
http://127.0.0.1:5000
```

---

# 🧠 How It Works

1. User enters or pastes a news article.
2. The application preprocesses the text.
3. AI analyzes the content.
4. The system classifies the article as:

   * ✅ Real
   * ❌ Fake
   * 🎭 Satire
5. Confidence scores and explanations are displayed.
6. Results are saved to the user's history.

---

# 📸 Screenshots

Add screenshots of:

* Home Page
* Login Page
* Dashboard
* News Analysis
* Image Verification
* Prediction Results
* History Page

---

# 🎯 Future Enhancements

* Voice-based news verification
* Browser extension
* Multi-language support
* Fact-checking from trusted news sources
* Mobile application
* PDF report generation
* AI chatbot assistant
* Social media URL verification
* Real-time news monitoring

---

# 👨‍💻 Developed By

**Gokul P**

Artificial Intelligence & Machine Learning Student

Passionate about AI, Machine Learning, Web Development, and Building Intelligent Applications.

---

# 🤝 Contributing

Contributions, feature requests, and suggestions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes.
4. Push to your branch.
5. Open a Pull Request.

---

# ⭐ Support

If you found this project helpful, please consider giving it a ⭐ on GitHub.

---

# 📄 License

This project is licensed under the **MIT License**.

---

## 💡 TruthLens

**"Empowering users to identify misinformation through AI-powered news verification."**
