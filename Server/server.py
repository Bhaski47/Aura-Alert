from flask import Flask, request, jsonify
import numpy as np
import librosa
from tensorflow.keras.models import load_model
from tensorflow.keras.utils import to_categorical
import os

# Initialize Flask app
app = Flask(__name__)

# Load the pre-trained model
MODEL_PATH = './scream_detection_model1.h5'
model = load_model(MODEL_PATH)

# Function to extract features from audio files
def extract_features(file_path, mfcc=True, chroma=True, mel=True):
    y, sr = librosa.load(file_path, mono=True)
    features = []
    if mfcc:
        mfccs = np.mean(librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13), axis=1)
        features.extend(mfccs)
    if chroma:
        chroma = np.mean(librosa.feature.chroma_stft(y=y, sr=sr), axis=1)
        features.extend(chroma)
    if mel:
        mel = np.mean(librosa.feature.melspectrogram(y=y, sr=sr), axis=1)
        features.extend(mel)
    return np.array(features)


@app.route('/upload', methods=['POST'])
def upload_audio():
    if 'audio' not in request.files:
        return jsonify({'status': 'error','error': 'No audio file in request'}), 400
    
    audio_file = request.files['audio']
    save_path = os.path.join("uploads", audio_file.filename)
    audio_file.save(save_path)
    
    return jsonify({'status': 'success', 'file_saved': audio_file.filename}), 200


# Prediction endpoint
@app.route('/predict', methods=['POST'])
def predict_audio():
    # Check if the audio file is present in the request
    if 'file' not in request.files:
        return jsonify({'status': 'error','error': 'No file provided'}), 200
    
    file = request.files['file']
    
    # Define the path for the temp directory
    temp_dir = 'temp'
    if not os.path.exists(temp_dir):
        os.makedirs(temp_dir)
    
    # Save the uploaded file temporarily
    file_path = os.path.join(temp_dir, file.filename)
    file.save(file_path)
    
    # Extract features and reshape them to fit the model input
    features = extract_features(file_path)
    features = np.expand_dims(features, axis=0)  # Reshape to match the model's input shape (1, n_features)

    # Run prediction
    prediction = model.predict(features)
    predicted_label = np.argmax(prediction)

    # Clean up temporary file
    os.remove(file_path)

    # Determine the result based on the predicted label
    if predicted_label == 1:
        result = "Dangerous sound detected. Alerting Police"
    else:
        result = "No dangerous sound detected"
    
    # Return the prediction result as JSON
    return jsonify({'prediction': result, 'confidence': float(prediction[0][predicted_label])})

# Main entry point
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=500, debug=True)