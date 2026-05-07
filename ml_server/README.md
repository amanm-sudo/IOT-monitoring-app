# ML Predict Server

Flask wrapper around your trained joblib thermal comfort model.

## Setup

```bash
cd ml_server

# 1. Install deps
pip install -r requirements.txt

# 2. Copy your trained model here
#    The file must be named: model.pkl
cp /path/to/your/model.pkl ./model.pkl

# 3. Run the server
python predict_server.py
# → runs on http://localhost:8000
```

## Adjusting Feature Order

Open `predict_server.py` and find `encode_features()`.
The current feature vector is:

```
[gender, thermal_sensation, activity, clothing, air_movement, humidity_pref, temperature, humidity, co2]
```

**Change the order to match exactly how your model was trained.**

## Testing

```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "gender": "male",
    "thermal_sensation": 1,
    "activity": "resting",
    "clothing": "light",
    "air_movement": "slight",
    "humidity_pref": "comfortable",
    "temperature": 27.5,
    "humidity": 60,
    "co2": 750
  }'
```

Expected response:
```json
{
  "comfort_level": 2,
  "label": "Slightly Warm / Neutral",
  "action": "Environment is within acceptable comfort range."
}
```

## Without model.pkl

The server falls back to a rule-based heuristic based on `thermal_sensation`.
This lets the frontend work even before your model is connected.
