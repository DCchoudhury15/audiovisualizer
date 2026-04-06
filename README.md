# AudioVisualizer

![AudioVisualizer Screenshot](https://github.com/DCchoudhury15/audiovisualizer/blob/main/ss%26vid/Screenshot%20from%202025-08-16%2016-26-36.png)![AudioVisualizer Screenshot](https://github.com/DCchoudhury15/audiovisualizer/blob/main/ss%26vid/Screenshot%20from%202025-08-16%2016-26-31.png)

[Demo link](https://github.com/DCchoudhury15/audiovisualizer/blob/main/ss%26vid/Screencast%20from%202025-08-16%2016-02-08.webm)

AudioVisualizer is an **audio classification and visualization system** that uses a deep learning CNN (Convolutional Neural Network) to identify sounds from `.wav` files and renders the model's internals as interactive visual outputs. It consists of:

- A **Python backend** for GPU-accelerated model training and inference (served via [Modal](https://modal.com/))
- A **Next.js/TypeScript frontend** (`audioimpression/`) for uploading audio and exploring predictions, spectrograms, waveforms, and CNN feature maps

---

## Features

- **Audio Classification**: Identifies sounds across 50 environmental categories (ESC-50 dataset) with top-3 confidence scores.
- **Mel Spectrogram Visualization**: Renders the input Mel Spectrogram as an interactive colour heatmap.
- **CNN Feature Map Inspection**: Displays the channel-averaged activation maps for every convolutional layer (`conv1`, `layer1`–`layer4` and internal residual blocks), so you can see how the network "sees" audio.
- **Waveform Display**: Shows the raw audio amplitude over time as an SVG line plot.
- **Cloud GPU Inference**: Inference runs on a Modal-hosted A10G GPU — no local GPU required.
- **Extensible Model**: The ResNet-34-style `AudioCNN` supports optional feature-map extraction via a single flag, making it easy to adapt for other visualizations.

---

## Architecture Overview

The project has three layers:

### 1. Model Training (`train.py`)

- Downloads the **ESC-50 dataset** (2000 × 5-second clips, 50 classes) at build time inside Modal.
- Converts audio to mono, then transforms it into **128-band Mel Spectrograms** (sample rate 22050 Hz, n_fft=1024, hop_length=512) followed by `AmplitudeToDB`.
- **Data augmentation**: `FrequencyMasking`, `TimeMasking`, and **Mixup** (β(0.2, 0.2), applied 30% of batches).
- Trains for 100 epochs with `AdamW` (lr=0.0005, weight_decay=0.01) + `OneCycleLR` scheduler and `CrossEntropyLoss` with label smoothing=0.1.
- Best checkpoint is saved to a Modal persistent volume (`esc-model`).
- Training metrics (loss, accuracy, learning rate) are logged to **TensorBoard**.

### 2. Inference API (`main.py`)

- Deployed as a GPU-backed Modal class (`AudioClassifier`) that loads the checkpoint on startup.
- Exposes a POST endpoint that accepts a base64-encoded WAV file.
- Processing pipeline:
  1. Decodes base64 → WAV → numpy float32
  2. Converts stereo to mono
  3. Resamples to 44100 Hz if needed
  4. Converts to Mel Spectrogram
  5. Runs the CNN with `return_feature_maps=True`
  6. Returns **top-3 predictions**, all **intermediate feature maps**, the **input spectrogram**, and a **downsampled waveform** (≤8000 samples)

### 3. Frontend Web App (`audioimpression/`)

- Next.js 15 single-page app. Upload a `.wav` file; the browser encodes it as base64 and POSTs directly to the Modal inference endpoint.
- Results are displayed as:
  - **Top Predictions** — top-3 classes with emoji icons and confidence progress bars
  - **Input Spectrogram** — SVG heatmap (blue = positive activation, white = zero, orange = negative)
  - **Audio Waveform** — SVG line path of raw amplitude samples
  - **Convolutional Layer Outputs** — 5-column grid of per-layer and per-block feature map heatmaps

---

## CNN Architecture (`model.py`)

`AudioCNN` is a **ResNet-34-style CNN** that treats the 2D Mel Spectrogram as a single-channel image:

| Stage | Details |
|-------|---------|
| Input | `(1, 128, T)` Mel Spectrogram |
| conv1 | Conv2d(1→64, k=7, stride=2) + BN + ReLU + MaxPool |
| layer1 | 3 × ResidualBlock(64→64) |
| layer2 | 4 × ResidualBlock(64→128, first stride=2) |
| layer3 | 6 × ResidualBlock(128→256, first stride=2) |
| layer4 | 3 × ResidualBlock(256→512, first stride=2) |
| Classifier | AdaptiveAvgPool2d(1,1) → Dropout(0.5) → Linear(512→num_classes) |

`ResidualBlock.forward()` accepts an optional `fmap_dict` argument; when provided it records activations at each `.conv` and `.relu` stage, enabling per-block visualization.

---

## Dataset

The model is trained on [ESC-50](https://github.com/karolpiczak/ESC-50):
- 2000 × 5-second labelled audio clips across 50 environmental sound categories
- Animals (dog, cat, frog, …), nature (rain, wind, sea waves, …), human sounds (clapping, coughing, …), urban noises (car horn, siren, …)
- 5-fold cross-validation — fold 5 used for testing, folds 1–4 for training

---

## Tech Stack

### Backend (Python)

| Library | Purpose |
|---------|---------|
| `torch` / `torchaudio` | CNN model, Mel Spectrogram transforms, training loop |
| `librosa` | Audio resampling during inference |
| `soundfile` | WAV file I/O |
| `modal` | Serverless GPU compute (training + inference endpoint) |
| `fastapi` (via Modal) | REST inference endpoint |
| `tensorboard` | Training metrics logging |
| `pandas`, `numpy`, `tqdm`, `pydantic` | Data processing and validation |

### Frontend (TypeScript)

| Library | Purpose |
|---------|---------|
| Next.js 15 | React framework (App Router) |
| React 19 | UI rendering |
| Tailwind CSS 4 | Styling |
| Radix UI | Accessible UI primitives (Progress, Slot) |
| Zod | Schema validation |

---

## Key Files

| File | Role |
|------|------|
| `model.py` | ResNet-34-style CNN with optional feature map extraction |
| `train.py` | Modal-based GPU training pipeline on ESC-50 |
| `main.py` | Modal inference API endpoint + local test entrypoint |
| `chirpingbirds.wav` | Sample WAV file for local testing |
| `requirements.txt` | Python dependencies |
| `tensorboard_logs/` | Saved TensorBoard runs from training |
| `audioimpression/src/app/page.tsx` | Next.js main page: file upload, API call, results rendering |
| `audioimpression/src/components/Waveform.tsx` | SVG waveform renderer |
| `audioimpression/src/components/ui/FeatureMap.tsx` | SVG heatmap renderer for spectrograms and feature maps |
| `audioimpression/src/components/ui/ColorScale.tsx` | Gradient legend for heatmap colour scale |
| `audioimpression/src/lib/colors.ts` | Blue/white/orange diverging colour mapping function |

---

## Prerequisites

- **Python 3.8+** and `pip`
- A [Modal](https://modal.com/) account (free tier available) for cloud GPU training and inference
- **Node.js 18+** and `npm` for the frontend
- A `.wav` audio file for testing

---

## Setup and Usage

### 1. Clone the Repository

```bash
git clone https://github.com/DCchoudhury15/audiovisualizer.git
cd audiovisualizer
```

### 2. Backend — Train the Model

```bash
# Install Python dependencies
pip install -r requirements.txt

# Authenticate with Modal
pip install modal
modal token new

# Run training on a cloud GPU (downloads ESC-50 automatically)
modal run train.py
```

Training runs for 100 epochs on a Modal A10G GPU. The best checkpoint is saved to the `esc-model` Modal volume.

### 3. Backend — Deploy the Inference Endpoint

```bash
# Deploy the inference API
modal deploy main.py

# Test locally using the included sample file
modal run main.py
```

### 4. Frontend — Run the Web App

```bash
cd audioimpression
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), upload a `.wav` file, and explore the predictions, spectrogram, waveform, and CNN feature maps.

> **Note:** The inference endpoint URL is hardcoded in `audioimpression/src/app/page.tsx`. Update it to your own deployed Modal endpoint URL after running `modal deploy main.py`.

---

## Troubleshooting

- **Modal auth errors**: Run `modal token new` and follow the prompts.
- **`libsndfile` not found**: Install it with `apt install libsndfile1` (Linux) or `brew install libsndfile` (macOS).
- **Frontend API errors**: Ensure the Modal inference deployment is active and the endpoint URL in `page.tsx` is correct.
- **Slow inference on first request**: The Modal container cold-starts in ~10–15 seconds; subsequent requests are fast.
- If issues persist, open an issue on GitHub with your OS, Python version, and full error message.

