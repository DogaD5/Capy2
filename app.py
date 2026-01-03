from flask import Flask, render_template, request, jsonify
import datetime

app = Flask(__name__)

LOG_FILE = "yazilanlar.txt"


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/log", methods=["POST"])
def log_text():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({
            "status": "error",
            "message": "Geçersiz veya boş JSON"
        }), 400

    user_name = data.get("name", "Anonim").strip()
    user_text = data.get("text", "").strip()

    if not user_text:
        return jsonify({
            "status": "error",
            "message": "Metin boş"
        }), 400

    try:
        tarih = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"[{tarih}] [{user_name}]: {user_text}\n")
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": "Dosyaya yazılamadı",
            "detail": str(e)
        }), 500

    return jsonify({"status": "success"}), 200
