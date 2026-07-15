import os
import subprocess
import tempfile

import soundfile as sf
import torch
from fastapi import FastAPI, HTTPException, UploadFile
from speechbrain.inference.speaker import EncoderClassifier

app = FastAPI()

model = EncoderClassifier.from_hparams(
    source="speechbrain/spkrec-ecapa-voxceleb",
    savedir="model_cache",
)

TARGET_SAMPLE_RATE = 16000


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/embed")
async def embed(file: UploadFile):
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename or "")[1] or ".bin") as raw_tmp:
        raw_tmp.write(await file.read())
        raw_path = raw_tmp.name

    wav_path = raw_path + ".wav"

    try:
        result = subprocess.run(
            [
                "ffmpeg", "-y", "-i", raw_path,
                "-ac", "1", "-ar", str(TARGET_SAMPLE_RATE),
                wav_path,
            ],
            capture_output=True,
        )
        if result.returncode != 0:
            raise HTTPException(status_code=400, detail="Could not decode audio")

        signal, sample_rate = sf.read(wav_path, dtype="float32")
        if sample_rate != TARGET_SAMPLE_RATE:
            raise HTTPException(status_code=400, detail="Unexpected sample rate after conversion")

        tensor = torch.from_numpy(signal).float().unsqueeze(0)
        with torch.no_grad():
            embedding = model.encode_batch(tensor)

        return {"embedding": embedding.squeeze().tolist()}
    finally:
        for path in (raw_path, wav_path):
            if os.path.exists(path):
                os.remove(path)
