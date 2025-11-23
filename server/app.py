from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
from dotenv import load_dotenv
from shioaji_service import shioaji_service
import threading
import time

# Load environment variables
basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '.env'))

app = Flask(__name__)
CORS(app, origins=[
    "https://iamboy.info",
    "https://www.iamboy.info",
    "http://localhost:5173",
    "http://localhost:3000"
])  # Enable CORS for specified origins

# Start Shioaji in a background thread to avoid blocking Flask startup
def start_shioaji():
    # Give some time for env vars to load and server to start
    time.sleep(2)
    shioaji_service.connect()

threading.Thread(target=start_shioaji, daemon=True).start()

@app.route('/api/market-data', methods=['GET'])
def get_market_data():
    data = shioaji_service.get_data()
    status = shioaji_service.get_status()
    return jsonify({
        "status": status,
        "data": data
    })

@app.route('/api/history-data', methods=['GET'])
def get_history_data():
    date_str = request.args.get('date')
    is_night = request.args.get('night', 'false').lower() == 'true'
    
    if not date_str:
        return jsonify({"error": "Missing date parameter"}), 400

    data = shioaji_service.get_history_kbars(date_str, is_night)
    return jsonify({"data": data})


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "message": "Server is running"})

@app.route('/api/send-telegram', methods=['POST'])
def send_telegram():
    data = request.json
    token = data.get('token')
    chat_id = data.get('chatId')
    message = data.get('message')

    if not token or not chat_id or not message:
        return jsonify({"error": "Missing token, chatId, or message"}), 400

    telegram_url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "HTML"
    }

    try:
        response = requests.post(telegram_url, json=payload)
        response.raise_for_status()
        return jsonify({"success": True, "data": response.json()})
    except requests.exceptions.RequestException as e:
        print(f"Telegram API Error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
