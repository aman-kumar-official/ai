from flask import Flask, render_template, request, redirect, url_for, flash, send_from_directory, jsonify
from flask_cors import CORS, cross_origin
import os
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import matplotlib.pyplot as plt
import seaborn as sns
import io
import base64
import subprocess
import platform
from pathlib import Path
import time
import random
from datetime import datetime, timedelta

# Initialize Flask app with CORS support
app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {"origins": "*"},  # Allow all domains to access API endpoints
    r"/static/*": {"origins": "*"}  # Allow static files
})

# App configuration
app.secret_key = 'your_secret_key_here'
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB limit
app.config['CAPTURE_FOLDER'] = 'captures'
app.config['CORS_HEADERS'] = 'Content-Type'

# Ensure directories exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['CAPTURE_FOLDER'], exist_ok=True)

# ======================== Utility Functions ========================

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'csv', 'pcap'}

def find_tshark():
    """Try to locate tshark.exe on Windows"""
    if platform.system() == "Windows":
        paths_to_try = [
            r"C:\Program Files\Wireshark\tshark.exe",
            r"C:\Program Files (x86)\Wireshark\tshark.exe",
            r"C:\Program Files\Wireshark\bin\tshark.exe",
            r"C:\Program Files (x86)\Wireshark\bin\tshark.exe"
        ]
        
        for path in paths_to_try:
            if os.path.exists(path):
                return path
    
    # Check if tshark is in PATH
    try:
        subprocess.run(['tshark', '--version'], check=True, 
                      stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return 'tshark'
    except:
        return None

# ======================== Core Functionality ========================

def capture_wifi_traffic(duration=30):
    """Capture Wi-Fi traffic and save as output.csv"""
    try:
        tshark_path = find_tshark()
        if not tshark_path:
            raise Exception("Tshark not found. Please install Wireshark first.")

        output_file = os.path.join(app.config['CAPTURE_FOLDER'], 'output.csv')
        
        interface = "Wi-Fi" if platform.system() == "Windows" else "wlan0"
        
        command = [
            tshark_path,
            '-i', interface,
            '-a', f'duration:{duration}',
            '-T', 'fields',
            '-e', 'frame.number',
            '-e', 'frame.time',
            '-e', 'ip.src',
            '-e', 'ip.dst',
            '-e', 'tcp.srcport',
            '-e', 'tcp.dstport',
            '-e', 'udp.srcport',
            '-e', 'udp.dstport',
            '-e', 'http.host',
            '-e', 'http.request.method',
            '-e', 'dns.qry.name',
            '-E', 'header=y',
            '-E', 'separator=,',
            '-E', 'quote=d',
            '-E', 'occurrence=f'
        ]
        
        print(f"Starting Wi-Fi capture for {duration} seconds...")
        
        with open(output_file, 'w') as f:
            subprocess.run(command, stdout=f, check=True)
        
        print(f"Capture complete. Data saved to {output_file}")
        return output_file
    except Exception as e:
        raise Exception(f"Capture failed: {str(e)}")

def preprocess_data(filepath):
    """Load and preprocess the data from output.csv"""
    try:
        data = pd.read_csv(filepath)
        
        # Basic preprocessing
        categorical_cols = data.select_dtypes(include=['object']).columns
        for col in categorical_cols:
            data[col] = data[col].astype('category').cat.codes
        
        data.fillna(data.mean(), inplace=True)
        return data
    except Exception as e:
        raise Exception(f"Data preprocessing failed: {str(e)}")

def detect_anomalies(data, contamination=0.05):
    """Detect anomalies using Isolation Forest"""
    try:
        scaler = StandardScaler()
        scaled_data = scaler.fit_transform(data)
        
        iso_forest = IsolationForest(
            n_estimators=100,
            max_samples='auto',
            contamination=contamination,
            random_state=42
        )
        
        anomalies = iso_forest.fit_predict(scaled_data)
        data['anomaly'] = np.where(anomalies == -1, 1, 0)
        return data, iso_forest
    except Exception as e:
        raise Exception(f"Anomaly detection failed: {str(e)}")

def create_plot(data, feature1, feature2):
    """Create visualization of anomalies"""
    try:
        plt.figure(figsize=(10, 6))
        
        normal = data[data['anomaly'] == 0]
        anomalous = data[data['anomaly'] == 1]
        
        plt.scatter(normal[feature1], normal[feature2], c='blue', label='Normal', alpha=0.5)
        plt.scatter(anomalous[feature1], anomalous[feature2], c='red', label='Anomaly', alpha=0.8, edgecolors='k')
        
        plt.xlabel(feature1)
        plt.ylabel(feature2)
        plt.title(f'Anomaly Detection: {feature1} vs {feature2}')
        plt.legend()
        plt.grid(True)
        
        img = io.BytesIO()
        plt.savefig(img, format='png', bbox_inches='tight')
        img.seek(0)
        plt.close()
        
        return base64.b64encode(img.getvalue()).decode('utf-8')
    except Exception as e:
        raise Exception(f"Plot creation failed: {str(e)}")

# ======================== API Endpoints ========================

@app.route('/api/stats')
@cross_origin()
def get_stats():
    """Endpoint to get current threat statistics"""
    return jsonify({
        "data": {
            "threats": random.randint(30, 50),
            "critical": random.randint(3, 8),
            "falsePositives": random.randint(1, 5),
            "responseTime": round(random.uniform(1.5, 3.5), 1)
        }
    })

@app.route('/api/timeline')
@cross_origin()
def get_timeline():
    """Endpoint to get timeline data for charts"""
    hours = [f"{i}:00" for i in range(24)]
    threats = [random.randint(0, 20) for _ in range(24)]
    
    return jsonify({
        "data": {
            "labels": hours,
            "datasets": [{
                "label": "Threats",
                "data": threats,
                "color": "#ff3d71"
            }]
        }
    })

@app.route('/api/distribution')
@cross_origin()
def get_distribution():
    """Endpoint to get threat distribution data"""
    return jsonify({
        "data": {
            "labels": ["Malware", "Phishing", "DDoS", "Brute Force", "Other"],
            "data": [random.randint(10, 20), random.randint(5, 15), 
                    random.randint(3, 10), random.randint(2, 8), random.randint(5, 12)],
            "colors": ["#ff3d71", "#ffaa00", "#00e096", "#00f0ff", "#8a2be2"]
        }
    })

@app.route('/api/updates')
@cross_origin()
def get_updates():
    """Endpoint for polling updates (returns only new data)"""
    now = datetime.now()
    recent_threats = random.randint(0, 3)
    
    return jsonify({
        "timeline": {
            "labels": [f"{now.hour}:{now.minute}"],
            "datasets": [{
                "data": [recent_threats],
                "color": "#ff3d71"
            }]
        },
        "stats": {
            "threats": recent_threats,
            "critical": 1 if recent_threats > 0 else 0
        },
        "newAlert": {
            "name": random.choice(["Malware Detected", "Phishing Attempt", "Port Scan", "DDoS Alert"]),
            "description": "Potential security threat detected in network traffic",
            "severity": random.choice(["critical", "high", "medium"]),
            "icon": random.choice(["skull", "user-secret", "exclamation-triangle"])
        } if recent_threats > 0 else None
    })

@app.route('/api/threats')
@cross_origin()
def get_threats_by_range():
    """Endpoint for time-filtered threat data"""
    range_param = request.args.get('range', '24h')
    
    if range_param == '24h':
        hours = 24
    elif range_param == '7d':
        hours = 168
    elif range_param == '30d':
        hours = 720
    else:
        hours = 24
    
    labels = []
    current_time = datetime.now()
    
    for i in range(hours, 0, -1):
        time_point = current_time - timedelta(hours=i)
        labels.append(time_point.strftime("%m/%d %H:%M"))
    
    data_points = [random.randint(0, 20) for _ in range(hours)]
    
    return jsonify({
        "timeline": {
            "labels": labels,
            "datasets": [{
                "label": "Threats",
                "data": data_points,
                "color": "#ff3d71"
            }]
        },
        "distribution": {
            "labels": ["Malware", "Phishing", "DDoS", "Brute Force", "Other"],
            "data": [random.randint(10, 20), random.randint(5, 15), 
                    random.randint(3, 10), random.randint(2, 8), random.randint(5, 12)],
            "colors": ["#ff3d71", "#ffaa00", "#00e096", "#00f0ff", "#8a2be2"]
        },
        "stats": {
            "threats": sum(data_points),
            "critical": sum(1 for x in data_points if x > 15),
            "falsePositives": random.randint(1, 5),
            "responseTime": round(random.uniform(1.5, 3.5), 1)
        }
    })

@app.route('/api/quick-scan', methods=['POST'])
@cross_origin()
def quick_scan():
    """Endpoint to initiate a quick scan"""
    time.sleep(2)  # Simulate scan time
    threats_found = random.randint(0, 5)
    vulnerabilities = random.randint(0, 3)
    
    return jsonify({
        "threatsFound": threats_found,
        "vulnerabilities": vulnerabilities,
        "message": "Scan completed successfully"
    })

# ======================== Web Routes ========================

@app.route('/', methods=['GET', 'POST'])
def index():
    if request.method == 'POST':
        if 'capture' in request.form:
            try:
                duration = int(request.form.get('capture_duration', 30))
                filename = capture_wifi_traffic(duration)
                flash(f'Successfully captured Wi-Fi traffic to output.csv')
                return redirect(url_for('analyze', filename='output.csv'))
            except Exception as e:
                flash(f'Capture failed: {str(e)}')
                return redirect(request.url)
        
        if 'file' not in request.files:
            flash('No file selected')
            return redirect(request.url)
        
        file = request.files['file']
        if file.filename == '':
            flash('No file selected')
            return redirect(request.url)
        
        if file and allowed_file(file.filename):
            try:
                filename = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
                file.save(filename)
                return redirect(url_for('analyze', filename=file.filename))
            except Exception as e:
                flash(f'Error processing file: {str(e)}')
                return redirect(request.url)
        else:
            flash('Only CSV files are allowed')
            return redirect(request.url)
    
    # List existing files
    capture_files = []
    if os.path.exists(app.config['CAPTURE_FOLDER']):
        capture_files = [f for f in os.listdir(app.config['CAPTURE_FOLDER']) if f.endswith('.csv')]
    
    upload_files = []
    if os.path.exists(app.config['UPLOAD_FOLDER']):
        upload_files = [f for f in os.listdir(app.config['UPLOAD_FOLDER']) if f.endswith('.csv')]
    
    return render_template('index2.html', capture_files=capture_files, upload_files=upload_files)

@app.route('/analyze/<filename>', methods=['GET'])
def analyze(filename):
    try:
        # Determine if file is in uploads or captures folder
        if filename in os.listdir(app.config['CAPTURE_FOLDER']):
            filepath = os.path.join(app.config['CAPTURE_FOLDER'], filename)
        else:
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        # Default parameters
        contamination = 0.05
        
        # Process data
        data = preprocess_data(filepath)
        
        # Use first two numerical columns for visualization
        numerical_cols = data.select_dtypes(include=[np.number]).columns.tolist()
        feature1 = numerical_cols[0]
        feature2 = numerical_cols[1] if len(numerical_cols) > 1 else numerical_cols[0]
        
        # Detect anomalies
        data_with_anomalies, _ = detect_anomalies(data, contamination)
        
        # Generate plot
        plot_url = create_plot(data_with_anomalies, feature1, feature2)
        
        # Calculate stats
        anomaly_count = data_with_anomalies['anomaly'].sum()
        total_count = len(data_with_anomalies)
        anomaly_percent = (anomaly_count / total_count) * 100
        
        # Save cleaned data
        clean_data = data_with_anomalies[data_with_anomalies['anomaly'] == 0].drop('anomaly', axis=1)
        clean_filename = 'cleaned_' + filename
        clean_filepath = os.path.join(app.config['UPLOAD_FOLDER'], clean_filename)
        clean_data.to_csv(clean_filepath, index=False)
        
        return render_template('analyze.html', 
                            plot_url=plot_url,
                            filename=filename,
                            clean_filename=clean_filename,
                            features=numerical_cols,
                            selected_feature1=feature1,
                            selected_feature2=feature2,
                            contamination=contamination,
                            anomaly_count=anomaly_count,
                            total_count=total_count,
                            anomaly_percent=round(anomaly_percent, 2))
    
    except Exception as e:
        flash(f'Error analyzing file: {str(e)}')
        return redirect(url_for('index'))

@app.route('/download/<filename>')
def download(filename):
    if filename in os.listdir(app.config['CAPTURE_FOLDER']):
        return send_from_directory(app.config['CAPTURE_FOLDER'], filename, as_attachment=True)
    else:
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename, as_attachment=True)

# ======================== Main Execution ========================

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)