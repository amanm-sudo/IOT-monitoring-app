"""
UGQ Thermal Comfort Prediction Server
Pipeline: ColumnTransformer -> VarianceThreshold -> LogisticRegression
34 features (computed from questionnaire + live sensor data)
Run: python predict_server.py
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import numpy as np
import math
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

# ── Load model ──────────────────────────────────────────────
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'model.pkl')
model = None

# Try 1: load from file
if os.path.exists(MODEL_PATH):
    try:
        model = joblib.load(MODEL_PATH)
        print(f"[OK] Model loaded from file: {MODEL_PATH}")
    except Exception as e:
        print(f"[WARN] Failed to load model.pkl: {e}")

# Try 2: load from MODEL_B64 environment variable (for cloud deployments)
if model is None:
    b64 = os.environ.get('MODEL_B64', '')
    if b64:
        try:
            import base64, io as _io
            model = joblib.load(_io.BytesIO(base64.b64decode(b64)))
            print("[OK] Model loaded from MODEL_B64 env variable")
        except Exception as e:
            print(f"[WARN] Failed to decode MODEL_B64: {e}")

if model is None:
    print("[WARN] No model loaded — rule-based fallback will be used")
else:
    print(f"     Steps: {[(n, type(e).__name__) for n, e in model.steps]}")


# ── Comfort output maps ──────────────────────────────────────
COMFORT_LABELS = {
    0: 'Cold',
    1: 'Slightly Cool / Neutral',
    2: 'Slightly Warm / Neutral',
    3: 'Hot',
}
COMFORT_ACTIONS = {
    0: 'Consider increasing room temperature or reducing ventilation.',
    1: 'Environment is within acceptable comfort range.',
    2: 'Environment is within acceptable comfort range.',
    3: 'Consider lowering room temperature or increasing ventilation.',
}

# ── Questionnaire → model-feature encoding ──────────────────
# Maps questionnaire card values to numeric model features
CLOTHING_CLO = {'minimal': 0.3, 'light': 0.57, 'medium': 0.9, 'heavy': 1.5}
ACTIVITY_MET = {'resting': 0.8, 'standing': 1.2, 'walking': 2.0, 'exercise': 3.5}
AIRFLOW_VA   = {'still': 0.05, 'slight': 0.1, 'moderate': 0.3, 'strong': 0.8}
GENDER_AGE   = {'male': 25, 'female': 25, 'other': 25}   # age fallback
FAN_LEVEL    = {'still': 0, 'slight': 1, 'moderate': 2, 'strong': 3}
WINDOW_MAP   = {'less': 0, 'same': 0, 'more': 1}
AQI_CATEGORY = {'excellent': 0, 'good': 1, 'moderate': 2, 'poor': 3}


def compute_pmv(T, T_r, v_a, M, I_cl):
    """Simplified Fanger PMV approximation."""
    try:
        T_cl = 35.7 - 0.028 * (M - 0.58 * 58.15) - I_cl * (
            3.96e-8 * (T_cl_prev := 35.0) ** 4 + 0.1 * v_a ** 0.5 * (T_cl_prev - T)
        )
        # Simplified linear PMV estimate
        pmv = 0.352 * math.exp(-0.2387 * M) * (
            M - 0.35 * (0.06 - 0.0014 * M) * (5733 - 6.99 * M - 58)
            - 0.42 * (M - 0.35 * 58)
            - 0.0023 * M * (44 - 58)
            - 0.0014 * M * (34 - T)
            - 3.96e-8 * ((T_cl_prev + 273) ** 4 - (T_r + 273) ** 4)
            - 1.0 * v_a ** 0.5 * (T_cl_prev - T)
        )
        return round(float(pmv), 3)
    except Exception:
        # Fallback: linear estimate
        return round((T - 22) * 0.2 + (M - 1.0) * 0.5 - I_cl * 0.3, 3)


def build_features(data: dict) -> pd.DataFrame:
    """
    Convert questionnaire answers + live sensor readings into the 34-feature
    DataFrame the model pipeline expects.
    """
    now = datetime.now()

    # ── Questionnaire inputs ──
    clothing_str = str(data.get('clothing', 'light')).lower()
    activity_str = str(data.get('activity', 'resting')).lower()
    airflow_str  = str(data.get('air_movement', 'slight')).lower()
    gender_str   = str(data.get('gender', 'male')).lower()
    vent_str     = str(data.get('ventilation_pref', 'same')).lower()

    I_cl   = CLOTHING_CLO.get(clothing_str, 0.57)
    M_met  = ACTIVITY_MET.get(activity_str, 1.0)
    v_a    = AIRFLOW_VA.get(airflow_str, 0.1)
    age    = GENDER_AGE.get(gender_str, 25)
    fan_lv = FAN_LEVEL.get(airflow_str, 1)
    win_st = WINDOW_MAP.get(vent_str, 0)

    # ── Live sensor data ──
    temp    = float(data.get('temperature', 25.0))
    hum     = float(data.get('humidity', 50.0))
    co2     = float(data.get('co2', 600))
    pm25    = float(data.get('pm2_5', 12.0))
    aqi     = float(data.get('final_aqi', 45.0))
    voltage = float(data.get('voltage', 230.0))
    current = float(data.get('current', 0.87))
    energy  = float(data.get('energy_kwh', 1.0))
    power_w = voltage * current
    power_kw = power_w / 1000.0

    # ── Computed features ──
    T_r   = temp                              # assume MRT ≈ air temp
    pmv   = compute_pmv(temp, T_r, v_a, M_met, I_cl)
    ppd   = 100 - 95 * math.exp(-0.03353 * pmv ** 4 - 0.2179 * pmv ** 2)
    apmv  = pmv                               # adaptive PMV approximation

    # THI (Temperature Humidity Index)
    thi = temp + 0.33 * hum - 0.7 * v_a - 4.0

    # AQI category
    if aqi < 50:   aqi_cat = 0
    elif aqi < 100: aqi_cat = 1
    elif aqi < 150: aqi_cat = 2
    else:           aqi_cat = 3

    # PMV band: 0=Cold(<-1), 1=Neutral(-1 to 1), 2=Warm(>1)
    pmv_band = 0 if pmv < -1 else (2 if pmv > 1 else 1)

    # Hour trig encoding
    h = now.hour
    hour_sin = math.sin(2 * math.pi * h / 24)
    hour_cos = math.cos(2 * math.pi * h / 24)

    row = {
        'hour_of_day':          h,
        'day_of_week':          now.weekday(),
        'age':                  age,
        'temperature':          temp,
        'humidity':             hum,
        'v_a':                  v_a,
        'fan_level_reported':   fan_lv,
        'I_cl':                 I_cl,
        'M_met':                M_met,
        'T_r':                  T_r,
        'co2':                  co2,
        'pm2_5':                pm25,
        'final_aqi':            aqi,
        'window_status':        win_st,
        'energy_kwh':           energy,
        'energy_kwh_delta':     0.0,
        'power_w':              power_w,
        'power_kw':             power_kw,
        'voltage':              voltage,
        'current':              current,
        'pmv_predicted':        pmv,
        'ppd':                  round(ppd, 3),
        'apmv':                 apmv,
        'co2_flag':             1 if co2 > 1000 else 0,
        'aqi_category':         aqi_cat,
        'month':                now.month,
        'is_weekend':           1 if now.weekday() >= 5 else 0,
        'merge_flag':           1,
        'temp_humidity_index':  round(thi, 3),
        'pmv_band':             pmv_band,
        'clo_met_ratio':        round(I_cl / M_met, 4),
        'hour_sin':             round(hour_sin, 6),
        'hour_cos':             round(hour_cos, 6),
        'aqi_pmv_interaction':  round(aqi * pmv, 4),
    }
    return pd.DataFrame([row])


# ── Routes ───────────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'model_loaded': model is not None})


@app.route('/predict', methods=['POST'])
def predict():
    data = request.json or {}

    if model is None:
        # Rule-based fallback when model.pkl not loaded
        ts   = float(data.get('thermal_sensation', 0))
        temp = float(data.get('temperature', 25))
        if ts <= -1.5 or temp < 20:   lvl = 0
        elif ts >= 1.5 or temp > 29:  lvl = 3
        elif ts < 0:                  lvl = 1
        else:                         lvl = 2
        return jsonify({
            'comfort_level': lvl,
            'label':  COMFORT_LABELS[lvl],
            'action': COMFORT_ACTIONS[lvl],
            'note':   'Rule-based fallback (model.pkl not loaded)',
        })

    try:
        df   = build_features(data)
        lvl  = int(model.predict(df)[0])
        lvl  = max(0, min(3, lvl))
        proba = None
        if hasattr(model, 'predict_proba'):
            proba = model.predict_proba(df)[0].tolist()

        return jsonify({
            'comfort_level': lvl,
            'label':         COMFORT_LABELS[lvl],
            'action':        COMFORT_ACTIONS[lvl],
            'probabilities': proba,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    print(f"[ML] Server running -> http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
