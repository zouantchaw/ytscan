#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import os
import traceback
import zipfile
from pathlib import Path
from typing import Any

import requests
import torch
from datasets import Dataset
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    DataCollatorForLanguageModeling,
    Trainer,
    TrainingArguments,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train a YTScan persona LoRA adapter.")
    parser.add_argument("--api-base-url", required=True)
    parser.add_argument("--job-id", required=True)
    parser.add_argument("--lease-token", required=True)
    parser.add_argument("--base-model", required=True)
    parser.add_argument("--hf-api-token", default="")
    parser.add_argument("--work-dir", default="/opt/ytscan-persona/run")
    return parser.parse_args()


def request_json(
    method: str,
    url: str,
    lease_token: str,
    payload: dict[str, Any] | None = None,
    timeout: int = 120,
) -> dict[str, Any]:
    headers = {"x-generation-lease-token": lease_token}
    if payload is not None:
        headers["content-type"] = "application/json"

    response = requests.request(
        method,
        url,
        headers=headers,
        json=payload,
        timeout=timeout,
    )
    response.raise_for_status()
    return response.json()


def post_progress(api_base_url: str, job_id: str, lease_token: str, **payload: Any) -> None:
    request_json(
        "POST",
        f"{api_base_url}/api/callback/generation-jobs/{job_id}/progress",
        lease_token,
        payload,
    )


def post_complete(api_base_url: str, job_id: str, lease_token: str, **payload: Any) -> None:
    request_json(
        "POST",
        f"{api_base_url}/api/callback/generation-jobs/{job_id}/complete",
        lease_token,
        payload,
    )


def post_fail(api_base_url: str, job_id: str, lease_token: str, **payload: Any) -> None:
    request_json(
        "POST",
        f"{api_base_url}/api/callback/generation-jobs/{job_id}/fail",
        lease_token,
        payload,
    )


def upload_asset(
    api_base_url: str,
    job_id: str,
    lease_token: str,
    asset_kind: str,
    file_path: Path,
    mime_type: str,
    *,
    variant: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    with file_path.open("rb") as handle:
        response = requests.post(
            f"{api_base_url}/api/callback/generation-jobs/{job_id}/assets",
            headers={"x-generation-lease-token": lease_token},
            data={
                "assetKind": asset_kind,
                "fileName": file_path.name,
                "mimeType": mime_type,
                "variant": variant or "",
                "metadata": json.dumps(metadata or {}),
            },
            files={"file": (file_path.name, handle, mime_type)},
            timeout=300,
        )

    response.raise_for_status()
    return response.json()["asset"]


def download_dataset(api_base_url: str, job_id: str, lease_token: str, dataset_path: Path) -> None:
    with requests.get(
        f"{api_base_url}/api/callback/generation-jobs/{job_id}/dataset",
        headers={"x-generation-lease-token": lease_token},
        timeout=300,
        stream=True,
    ) as response:
        response.raise_for_status()
        with dataset_path.open("wb") as handle:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    handle.write(chunk)


def format_messages(tokenizer: AutoTokenizer, messages: list[dict[str, str]]) -> str:
    if hasattr(tokenizer, "apply_chat_template"):
        return tokenizer.apply_chat_template(
            messages,
            add_generation_prompt=False,
            tokenize=False,
        )

    blocks: list[str] = []
    for message in messages:
        role = str(message.get("role", "user")).upper()
        content = str(message.get("content", "")).strip()
        blocks.append(f"{role}: {content}")
    return "\n\n".join(blocks)


def load_training_examples(dataset_path: Path, tokenizer: AutoTokenizer) -> list[dict[str, str]]:
    examples: list[dict[str, str]] = []
    for line in dataset_path.read_text(encoding="utf-8").splitlines():
        raw = line.strip()
        if not raw:
            continue
        record = json.loads(raw)
        messages = record.get("messages")
        if not isinstance(messages, list) or not messages:
            continue
        formatted = format_messages(tokenizer, messages)
        if formatted.strip():
            examples.append({"text": formatted})
    return examples


def tokenize_dataset(dataset: Dataset, tokenizer: AutoTokenizer) -> Dataset:
    def tokenize_row(row: dict[str, str]) -> dict[str, Any]:
        encoded = tokenizer(
            row["text"],
            truncation=True,
            max_length=1024,
            padding=False,
        )
        return encoded

    return dataset.map(tokenize_row, remove_columns=["text"])


def zip_directory(source_dir: Path, destination_path: Path) -> None:
    with zipfile.ZipFile(destination_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in source_dir.rglob("*"):
            if path.is_file():
                archive.write(path, path.relative_to(source_dir))


def build_style_samples(
    model: AutoModelForCausalLM, tokenizer: AutoTokenizer
) -> list[dict[str, str]]:
    prompts = [
        (
            "Contrarian hook",
            "Write a contrarian YouTube opening hook about hidden businesses nobody is talking about in 2026.",
        ),
        (
            "Operator explanation",
            "Explain why boring businesses create outsized leverage for first-time buyers in a concise YouTube paragraph.",
        ),
        (
            "Close",
            "Write a direct closing takeaway that pushes the viewer to take action this week.",
        ),
    ]
    samples: list[dict[str, str]] = []
    device = next(model.parameters()).device
    model.eval()

    for title, prompt in prompts:
        messages = [
            {
                "role": "system",
                "content": "You are writing in the creator's YouTube voice. Stay concrete, direct, and persuasive.",
            },
            {"role": "user", "content": prompt},
        ]
        rendered = format_messages(tokenizer, messages)
        encoded = tokenizer(rendered, return_tensors="pt").to(device)
        with torch.no_grad():
            generated = model.generate(
                **encoded,
                max_new_tokens=120,
                do_sample=True,
                temperature=0.85,
                top_p=0.92,
                pad_token_id=tokenizer.pad_token_id,
                eos_token_id=tokenizer.eos_token_id,
            )
        generated_tokens = generated[0][encoded["input_ids"].shape[-1] :]
        text = tokenizer.decode(generated_tokens, skip_special_tokens=True).strip()
        if text:
            samples.append(
                {
                    "title": title,
                    "prompt": prompt,
                    "content": text,
                    "source": "trained-persona",
                }
            )

    return samples


def main() -> None:
    args = parse_args()
    api_base_url = args.api_base_url.rstrip("/")
    job_id = args.job_id
    lease_token = args.lease_token
    work_dir = Path(args.work_dir)
    work_dir.mkdir(parents=True, exist_ok=True)
    dataset_path = work_dir / "persona-dataset.jsonl"
    adapter_dir = work_dir / "adapter"
    metrics_path = work_dir / "metrics.json"
    adapter_zip_path = work_dir / "persona-adapter.zip"

    try:
        post_progress(
            api_base_url,
            job_id,
            lease_token,
            stage="dataset",
            progress=0.18,
            status="running",
            message="Downloading persona training dataset",
        )
        download_dataset(api_base_url, job_id, lease_token, dataset_path)

        hf_token = args.hf_api_token.strip() or os.environ.get("HF_API_TOKEN", "").strip() or None

        post_progress(
            api_base_url,
            job_id,
            lease_token,
            stage="loading_model",
            progress=0.32,
            status="running",
            message=f"Loading base model {args.base_model}",
        )
        tokenizer = AutoTokenizer.from_pretrained(
            args.base_model,
            trust_remote_code=True,
            token=hf_token,
        )
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token or tokenizer.unk_token
        tokenizer.padding_side = "right"

        examples = load_training_examples(dataset_path, tokenizer)
        if not examples:
            raise RuntimeError("Persona dataset is empty after formatting.")

        train_dataset = Dataset.from_list(examples)
        tokenized_dataset = tokenize_dataset(train_dataset, tokenizer)

        use_cuda = torch.cuda.is_available()
        quantization_config = (
            BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_use_double_quant=True,
                bnb_4bit_compute_dtype=torch.float16,
            )
            if use_cuda
            else None
        )

        model = AutoModelForCausalLM.from_pretrained(
            args.base_model,
            trust_remote_code=True,
            token=hf_token,
            device_map="auto" if use_cuda else None,
            quantization_config=quantization_config,
            torch_dtype=torch.float16 if use_cuda else torch.float32,
        )
        if quantization_config is not None:
            model = prepare_model_for_kbit_training(model)
        model.config.use_cache = False

        lora_config = LoraConfig(
            r=16,
            lora_alpha=32,
            lora_dropout=0.05,
            bias="none",
            task_type="CAUSAL_LM",
            target_modules=[
                "q_proj",
                "k_proj",
                "v_proj",
                "o_proj",
            ],
        )
        model = get_peft_model(model, lora_config)

        post_progress(
            api_base_url,
            job_id,
            lease_token,
            stage="training",
            progress=0.52,
            status="running",
            message=f"Starting LoRA fine-tuning on {len(examples)} examples",
        )

        training_args = TrainingArguments(
            output_dir=str(work_dir / "trainer-output"),
            num_train_epochs=1,
            max_steps=min(320, max(80, len(examples))),
            per_device_train_batch_size=1,
            gradient_accumulation_steps=8,
            learning_rate=2e-4,
            warmup_ratio=0.03,
            logging_steps=5,
            save_strategy="no",
            report_to=[],
            remove_unused_columns=False,
            fp16=use_cuda,
            bf16=False,
            dataloader_pin_memory=use_cuda,
            optim="paged_adamw_8bit" if use_cuda else "adamw_torch",
        )

        trainer = Trainer(
            model=model,
            args=training_args,
            train_dataset=tokenized_dataset,
            data_collator=DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False),
        )
        train_result = trainer.train()

        post_progress(
            api_base_url,
            job_id,
            lease_token,
            stage="packaging",
            progress=0.86,
            status="running",
            message="Packaging adapter artifacts",
        )

        adapter_dir.mkdir(parents=True, exist_ok=True)
        model.save_pretrained(adapter_dir)
        zip_directory(adapter_dir, adapter_zip_path)

        metrics = {
            **train_result.metrics,
            "baseModel": args.base_model,
            "datasetExamples": len(examples),
            "hasGpu": use_cuda,
            "trainableParams": sum(
                parameter.numel() for parameter in model.parameters() if parameter.requires_grad
            ),
        }
        style_samples = build_style_samples(model, tokenizer)
        metrics["styleSamples"] = style_samples
        metrics_path.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

        adapter_asset = upload_asset(
            api_base_url,
            job_id,
            lease_token,
            "persona_adapter",
            adapter_zip_path,
            "application/zip",
            variant="lora-adapter",
            metadata={"baseModel": args.base_model, "datasetExamples": len(examples)},
        )
        metrics_asset = upload_asset(
            api_base_url,
            job_id,
            lease_token,
            "persona_metrics",
            metrics_path,
            "application/json",
            variant="training-metrics",
            metadata=metrics,
        )

        post_complete(
          api_base_url,
          job_id,
          lease_token,
          stage="completed",
          message="Persona training completed",
          output={
              "adapterAssetId": adapter_asset["id"],
              "metrics": metrics,
              "metricsAssetId": metrics_asset["id"],
              "styleSamples": style_samples,
          },
        )
    except Exception as exc:
        post_fail(
            api_base_url,
            job_id,
            lease_token,
            stage="failed",
            progress=0.92,
            message=str(exc)[:400],
            output={"traceback": traceback.format_exc()[-4000:]},
        )
        raise


if __name__ == "__main__":
    main()
