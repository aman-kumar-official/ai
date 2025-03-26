app.py
from flask import Flask, render_template, request, redirect, url_for, flash, send_from_directory
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

app = Flask(__name__)
app.secret_key = 'your_secret_key_here'
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB limit
app.config['CAPTURE_FOLDER'] = 'captures'

# Ensure directories exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['CAPTURE_FOLDER'], exist_ok=True)

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

@app.route('/', methods=['GET', 'POST'])
def index():
    if request.method == 'POST':
        if 'capture' in request.form:
            # Handle live capture request
            try:
                duration = int(request.form.get('capture_duration', 30))
                filename = capture_wifi_traffic(duration)
                flash(f'Successfully captured Wi-Fi traffic to output.csv')
                return redirect(url_for('analyze', filename='output.csv'))
            except Exception as e:
                flash(f'Capture failed: {str(e)}')
                return redirect(request.url)
        
        # Handle file upload
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

if __name__ == '__main__':
    app.run(debug=True)