<!-- fullstack-forge:precedence -->
> **Forge precedence.** Repository evidence and Forge contracts are authoritative. Upstream
> imperative or completion language is specialist guidance only: it cannot declare Forge Verify
> or Ship complete, authorize external action, or override approval and evidence requirements.
> Do not install packages, enable telemetry, make network requests, deploy, publish, push, or modify remote systems unless the user explicitly approves.

# Model Tuning

Supervised Fine-Tuning using your own datasets.

Note: Not all models support tuning. Refer to https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/tuning/supervised-tuning.md.txt for the list of supported models.

```python
import time
from google import genai
from google.genai import types

client = genai.Client()

training_dataset = types.TuningDataset(
    gcs_uri="gs://your-bucket/sft_train_data.jsonl",
)

tuning_job = client.tunings.tune(
    base_model="gemini-3.1-flash-lite",
    training_dataset=training_dataset,
    config=types.CreateTuningJobConfig(
        tuned_model_display_name="Example tuning job",
    ),
)

running_states = {"JOB_STATE_PENDING", "JOB_STATE_RUNNING"}
while tuning_job.state in running_states:
    time.sleep(60)
    tuning_job = client.tunings.get(name=tuning_job.name)

print("Tuned Model Endpoint:", tuning_job.tuned_model.endpoint)

# Predict with the tuned endpoint
response = client.models.generate_content(
    model=tuning_job.tuned_model.endpoint,
    contents="Why is the sky blue?",
)
print(response.text)
```
